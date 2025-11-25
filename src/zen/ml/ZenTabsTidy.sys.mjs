// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const { setTimeout } = ChromeUtils.importESModule('resource://gre/modules/Timer.sys.mjs');

export async function groupTabsBySimilarity({
  window: browserWindow,
  gBrowser,
  gZenUIManager,
  workspaceId,
  unpinnedTabs = [],
  setGroupingInProgress = () => {},
}) {
  if (!browserWindow || !gBrowser) {
    console.error('ZenTabsTidy: Missing browser window or tab browser');
    return;
  }

  const CustomEventCtor = browserWindow.CustomEvent || CustomEvent;
  browserWindow.dispatchEvent(new CustomEventCtor('ZenGroupingTabsStart'));
  setGroupingInProgress(true);

  try {
    if (unpinnedTabs.length < 2) {
      setGroupingInProgress(false);
      browserWindow.dispatchEvent(new CustomEventCtor('ZenGroupingTabsEnd'));
      return;
    }

    const tabData = collectTabData(unpinnedTabs);

    if (tabData.length < 2) {
      setGroupingInProgress(false);
      browserWindow.dispatchEvent(new CustomEventCtor('ZenGroupingTabsEnd'));
      return;
    }

    const clusters = await clusterTabsBySimilarity(tabData);

    for (const tab of gBrowser.tabs) {
      tab.removeAttribute('zen-category');
      tab.removeAttribute('zen-category-first');
    }

    await ungroupPreviousAutoCategories(gBrowser);

    clusters.sort((a, b) => {
      if (b.tabs.length !== a.tabs.length) {
        return b.tabs.length - a.tabs.length;
      }
      return a.label.localeCompare(b.label);
    });

    let categoryCount = 0;

    for (const cluster of clusters) {
      const clusterTabs = cluster.tabs
        .filter(
          (tab) =>
            tab &&
            !tab.closing &&
            !tab.hasAttribute('zen-essential') &&
            tab.ownerGlobal &&
            !tab.ownerGlobal.closed
        )
        .sort((a, b) => a._tPos - b._tPos);

      if (!clusterTabs.length) {
        continue;
      }

      const anchorTab = clusterTabs[0];
      if (!anchorTab?.parentNode) {
        continue;
      }

      if (typeof gBrowser.ungroupTab === 'function') {
        for (const tab of clusterTabs) {
          const tabGroup = tab.group;
          if (
            tabGroup &&
            !tabGroup.isZenFolder &&
            !tabGroup.hasAttribute?.('split-view-group')
          ) {
            try {
              gBrowser.ungroupTab(tab);
            } catch (error) {
              console.error('ZenTabsTidy: Error ungrouping tab before regrouping:', error);
            }
          }
        }
      }

      const groupsBefore = new Set(Array.from(gBrowser.tabGroups ?? []));
      const category = cluster.label || 'Group';
      try {
        gBrowser.addTabGroup(clusterTabs, {
          label: category,
          showCreateUI: false,
          insertBefore: anchorTab,
        });
      } catch (error) {
        console.error('ZenTabsTidy: Error creating tab group for category:', error);
        continue;
      }

      const createdGroup = Array.from(gBrowser.tabGroups ?? []).find(
        (group) => !groupsBefore.has(group)
      );
      if (createdGroup && typeof createdGroup.setAttribute === 'function') {
        createdGroup.setAttribute('zen-auto-category-group', 'true');
      }

      clusterTabs.forEach((tab, index) => {
        tab.setAttribute('zen-category', category);
        if (index === 0) {
          tab.setAttribute('zen-category-first', 'true');
        } else {
          tab.removeAttribute('zen-category-first');
        }
      });

      categoryCount++;
    }

    setTimeout(() => {
      setGroupingInProgress(false);
      browserWindow.dispatchEvent(new CustomEventCtor('ZenGroupingTabsEnd'));
    }, 500);

    if (categoryCount > 0 && gZenUIManager?.showToast) {
      gZenUIManager.showToast('zen-workspaces-group-tabs-toast', {
        l10nArgs: {
          count: categoryCount,
        },
      });
    }
  } catch (error) {
    console.error('ZenTabsTidy: Failed to group tabs by similarity:', error);
    setGroupingInProgress(false);
    browserWindow.dispatchEvent(new CustomEventCtor('ZenGroupingTabsEnd'));
    if (Services?.console?.logStringMessage) {
      Services.console.logStringMessage(
        `ZenTabsTidy: grouping failure${workspaceId ? ` for workspace ${workspaceId}` : ''}`
      );
    }
  }
}

function collectTabData(unpinnedTabs) {
  const tabData = [];

  for (const tab of unpinnedTabs) {
    try {
      const uri = tab.linkedBrowser?.currentURI;
      if (!uri) {
        continue;
      }

      if (uri.scheme === 'about' || uri.scheme === 'chrome') {
        continue;
      }

      const domain = uri.host.replace(/^(www\.|m\.|mobile\.)/, '');
      const title = preprocessText(tab.label || '');
      const opener = collectOpenerInfo(tab);

      tabData.push({
        tab,
        domain,
        title,
        url: uri.spec,
        opener,
        combinedText: `${domain} ${title}`,
      });
    } catch (error) {
      console.error('ZenTabsTidy: Error processing tab for grouping:', error);
    }
  }

  return tabData;
}

function collectOpenerInfo(tab) {
  if (!tab.openerTab || tab.openerTab.closing) {
    return null;
  }

  try {
    const openerUri = tab.openerTab.linkedBrowser?.currentURI;
    if (!openerUri) {
      return null;
    }

    const openerDomain = openerUri.host.replace(/^(www\.|m\.|mobile\.)/, '');
    const openerTitle = preprocessText(tab.openerTab.label || '');

    return {
      domain: openerDomain,
      title: openerTitle,
      url: openerUri.spec,
    };
  } catch (_) {
    return null;
  }
}

async function ungroupPreviousAutoCategories(gBrowser) {
  const autoCategoryGroups = Array.from(gBrowser.tabGroups ?? []).filter(
    (group) =>
      group &&
      typeof group.hasAttribute === 'function' &&
      group.hasAttribute('zen-auto-category-group')
  );

  if (typeof gBrowser.ungroupTab !== 'function') {
    return;
  }

  for (const group of autoCategoryGroups) {
    try {
      const tabsInGroup = Array.from(group.tabs ?? []);
      for (const tab of tabsInGroup) {
        if (!tab?.closing && tab.ownerGlobal && !tab.ownerGlobal.closed) {
          gBrowser.ungroupTab(tab);
        }
      }
    } catch (error) {
      console.error('ZenTabsTidy: Error ungrouping automatic tab group:', error);
    }
  }
}

async function clusterTabsBySimilarity(tabData) {
  const SIMILARITY_THRESHOLD = 0.22;

  const embeddings = await generateTabEmbeddings(tabData);
  const useAi = embeddings !== null;

  const similarities = [];
  for (let i = 0; i < tabData.length; i++) {
    similarities[i] = [];
    for (let j = 0; j < tabData.length; j++) {
      if (i === j) {
        similarities[i][j] = 1.0;
      } else if (useAi && embeddings[i] && embeddings[j]) {
        similarities[i][j] = cosineSimilarity(embeddings[i], embeddings[j]);
      } else {
        similarities[i][j] = calculateTextSimilarity(
          tabData[i].combinedText,
          tabData[j].combinedText
        );
      }
    }
  }

  const clusters = [];
  const used = new Array(tabData.length).fill(false);

  for (let i = 0; i < tabData.length; i++) {
    if (used[i]) continue;

    const clusterIndices = [i];
    const clusterTabs = [tabData[i].tab];
    used[i] = true;

    for (let j = 0; j < tabData.length; j++) {
      if (i !== j && !used[j] && similarities[i][j] > SIMILARITY_THRESHOLD) {
        clusterIndices.push(j);
        clusterTabs.push(tabData[j].tab);
        used[j] = true;
      }
    }

    clusters.push({
      indices: new Set(clusterIndices),
      tabs: clusterTabs,
    });
  }

  for (const cluster of clusters) {
    cluster.label = await generateDynamicClusterLabel(
      Array.from(cluster.indices).map((i) => tabData[i])
    );
  }

  return clusters;
}

function preprocessText(text) {
  if (!text) {
    return '';
  }

  const delimiters = /(?<=\s)[|–-]+(?=\s)/;
  const splitText = text.split(delimiters);
  const hasEnoughInfo = !!splitText.length && splitText.slice(0, -1).join(' ').length > 5;
  const isPotentialDomainInfo =
    splitText.length > 1 && splitText[splitText.length - 1].length < 20;

  if (hasEnoughInfo && isPotentialDomainInfo) {
    return splitText
      .slice(0, -1)
      .map((segment) => segment.trim())
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  return text.trim();
}

async function generateTabEmbeddings(tabData) {
  if (!Services.prefs.getBoolPref('browser.ml.enable', false)) {
    return null;
  }

  try {
    const { createEngine } = ChromeUtils.importESModule(
      'chrome://global/content/ml/EngineProcess.sys.mjs'
    );

    const engine = await createEngine({
      taskName: 'feature-extraction',
      modelId: 'Mozilla/smart-tab-embedding',
      modelHub: 'huggingface',
      engineId: 'embedding-engine',
    });

    const embeddings = await Promise.all(
      tabData.map(async (data, index) => {
        try {
          const text = `${data.title} ${data.domain}`;
          const result = await engine.run({ args: [text] });

          let embedding;
          if (result?.[0]?.embedding && Array.isArray(result[0].embedding)) {
            embedding = result[0].embedding;
          } else if (result?.[0] && Array.isArray(result[0])) {
            embedding = result[0];
          } else if (Array.isArray(result)) {
            embedding = result;
          } else {
            return null;
          }

          if (Array.isArray(embedding) && embedding.length > 0) {
            let pooled;
            if (typeof embedding[0] === 'number') {
              pooled = embedding;
            } else if (Array.isArray(embedding[0])) {
              const len = embedding[0].length;
              pooled = new Array(len).fill(0);
              for (const arr of embedding) {
                for (let i = 0; i < len; i++) {
                  pooled[i] += arr[i];
                }
              }
              for (let i = 0; i < len; i++) {
                pooled[i] /= embedding.length;
              }
            } else {
              return null;
            }

            const norm = Math.sqrt(pooled.reduce((sum, value) => sum + value * value, 0));
            return norm === 0 ? pooled : pooled.map((value) => value / norm);
          }
          return null;
        } catch (error) {
          console.warn(`ZenTabsTidy: Failed to generate embedding for tab ${index}:`, error);
          return null;
        }
      })
    );

    return embeddings;
  } catch (error) {
    console.warn('ZenTabsTidy: Failed to generate embeddings, falling back to text similarity:', error);
    return null;
  }
}

function cosineSimilarity(vec1, vec2) {
  if (!vec1 || !vec2 || vec1.length !== vec2.length) {
    return 0;
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }

  const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

function calculateTextSimilarity(text1, text2) {
  const words1 = new Set(
    text1
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 2)
  );
  const words2 = new Set(
    text2
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 2)
  );

  if (words1.size === 0 && words2.size === 0) {
    return 1.0;
  }
  if (words1.size === 0 || words2.size === 0) {
    return 0.0;
  }

  const intersection = new Set([...words1].filter((word) => words2.has(word)));
  const union = new Set([...words1, ...words2]);
  return intersection.size / union.size;
}

async function generateDynamicClusterLabel(clusterData) {
  if (clusterData.length === 1) {
    return generateClusterLabel(clusterData[0].domain);
  }

  try {
    const label = await generateAiClusterLabel(clusterData);
    if (label) {
      return label;
    }
  } catch (error) {
    console.warn('ZenTabsTidy: AI label generation failed, using fallback:', error);
  }

  const wordFreq = new Map();

  for (const data of clusterData) {
    const text = `${data.domain} ${data.title}`.toLowerCase();
    const words = text.split(/\s+/).filter((word) => word.length > 3);

    for (const word of words) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }
  }

  let bestWord = null;
  let bestCount = 0;

  for (const [word, count] of wordFreq.entries()) {
    if (count > 1 && count > bestCount) {
      bestCount = count;
      bestWord = word;
    }
  }

  if (bestWord) {
    return bestWord.charAt(0).toUpperCase() + bestWord.slice(1);
  }

  return generateClusterLabel(clusterData[0].domain);
}

async function generateAiClusterLabel(clusterData) {
  if (!Services.prefs.getBoolPref('browser.ml.enable', false)) {
    return null;
  }

  try {
    const { createEngine } = ChromeUtils.importESModule(
      'chrome://global/content/ml/EngineProcess.sys.mjs'
    );

    const tabDescriptions = clusterData
      .map((data, idx) => {
        let desc = `${idx + 1}. ${data.url}\n   Title: ${data.title}`;
        if (data.opener) {
          desc += `\n   ↳ Opened from: ${data.opener.domain} (${data.opener.title})`;
        }
        return desc;
      })
      .join('\n\n');

    const titles = clusterData.map((data) => data.title).filter((title) => title.length > 0);
    const keywords = extractKeywords(titles);
    const domains = [...new Set(clusterData.map((data) => data.domain))].join(', ');

    const prompt = `You are an expert organizer who creates concise, descriptive category names.

I have a group of browser tabs that belong together. Please create a short, descriptive category name (1-3 words) for this group.

Tabs in this group:
${tabDescriptions}

Common domains: ${domains}
${keywords.length > 0 ? `Keywords in common: ${keywords.join(', ')}` : ''}

Instructions:
- Look at the FULL URLs to understand the context (e.g., /shop/, /cars/, /docs/)
- Use the browsing history (↳ Opened from) to understand the user's intent
- Choose a GENERAL category name, not a specific brand name
- If tabs contain multiple brands (Nike, Adidas), use the category (e.g., "Sportswear" or "Athletic Brands")
- If tabs are car brands/manufacturers (Audi, Mercedes, Tesla), use "Automotive" or "Cars"
- If tabs are video platforms (YouTube, Vimeo), use "Video Platforms" or "Videos"
- If tabs are developer tools (GitHub, Jira, GitLab), use "Development" or "Dev Tools"
- Use the common theme or purpose, not individual site names
- Keep it 1-3 words maximum
- Capitalize properly

Category name:`;

    const engine = await createEngine({
      taskName: 'text2text-generation',
      modelId: 'Mozilla/smart-tab-topic',
      modelHub: 'huggingface',
      engineId: 'group-namer',
    });

    const aiResult = await engine.run({
      args: [prompt],
      options: {
        max_new_tokens: 10,
        temperature: 0.5,
      },
    });

    let name = (aiResult[0]?.generated_text || '').split('\n')[0].trim();

    if (!name || /none|adult content/i.test(name)) {
      return null;
    }

    name = toTitleCase(name);
    name = name
      .replace(/^['"`]+|['"`]+$/g, '')
      .replace(/[.?!,:;]+$/, '')
      .replace(/^(category name:|name:)\s*/i, '')
      .trim()
      .slice(0, 30);

    if (name && name.length > 0) {
      return name;
    }

    return null;
  } catch (error) {
    console.warn('ZenTabsTidy: AI label generation failed:', error);
    return null;
  }
}

function extractKeywords(titles) {
  const allWords = titles
    .join(' ')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2);

  const wordCount = new Map();
  allWords.forEach((word) => {
    wordCount.set(word, (wordCount.get(word) || 0) + 1);
  });

  const stopWords = new Set([
    'the',
    'and',
    'for',
    'are',
    'but',
    'not',
    'you',
    'all',
    'can',
    'had',
    'her',
    'was',
    'one',
    'our',
    'out',
    'day',
    'get',
    'has',
    'him',
    'his',
    'how',
    'man',
    'new',
    'now',
    'old',
    'see',
    'two',
    'way',
    'who',
    'boy',
    'did',
    'its',
    'let',
    'put',
    'say',
    'she',
    'too',
    'use',
    'com',
    'www',
    'http',
    'https',
    'org',
  ]);

  return Array.from(wordCount.entries())
    .filter(([word]) => !stopWords.has(word))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

function toTitleCase(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function generateClusterLabel(domain) {
  if (!domain) {
    return 'Other';
  }

  let label = domain.split('.')[0];
  label = label.charAt(0).toUpperCase() + label.slice(1);
  return label;
}

