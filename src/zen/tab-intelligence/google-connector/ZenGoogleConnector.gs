/**
 * Zen - Google Connector for Zen Browser
 * 
 * Ce script Google Apps Script fait office de pont (API) entre Google Workspace
 * (Gmail, Google Calendar) et le navigateur Zen.
 * 
 * Il permet à Zen de récupérer au survol (hover) des onglets Gmail et Google Calendar :
 * - Les 3 derniers e-mails non lus (expéditeur, objet, aperçu, lien direct)
 * - Les événements et réunions de la journée (heures, lien de visio Google Meet / Zoom / Teams)
 * ... le tout SANS avoir besoin de charger ou décharger les onglets dans le navigateur.
 * 
 * INSTRUCTIONS D'INSTALLATION (2 minutes) :
 * 1. Rendez-vous sur https://script.google.com/home
 * 2. Cliquez sur "Nouveau projet" et renommez-le "Zen" (en haut à gauche).
 * 3. Remplacez le code de Code.gs par ce fichier.
 * 4. (Optionnel) Définissez un mot de passe ou token dans la variable API_KEY ci-dessous.
 * 5. Cliquez sur "Déployer" (bouton bleu en haut à droite) > "Nouveau déploiement".
 * 6. Cliquez sur l'icône d'engrenage "Sélectionner le type" et choisissez "Application Web".
 * 7. Remplissez les champs :
 *    - Description : Zen Connector
 *    - Exécuter en tant que : "Moi" (votre compte Google)
 *    - Qui a accès : "Tout le monde" (Anyone)
 * 8. Cliquez sur "Déployer", accordez les autorisations nécessaires à votre propre script.
 * 9. Copiez l'URL de l'application Web (se terminant par /exec).
 * 10. Collez cette URL dans Zen : Réglages > Onglets > Tab Intelligence > URL de l'App Script Zen.
 */

// Clé secrète optionnelle pour sécuriser l'accès depuis Zen (laissez vide pour désactiver)
const API_KEY = "";

const VIDEO_CONFERENCE_REGEX =
  /https:\/\/(?:[a-zA-Z0-9-]+\.)?(?:meet\.google\.com\/[a-z0-9-]+|zoom\.us\/j\/\d+[^\s"'<>]*|teams\.microsoft\.com\/l\/meetup-join\/[^\s"'<>]+|webex\.com\/[^\s"'<>]+|meet\.jit\.si\/[^\s"'<>]+)/i;

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const params = e && e.parameter ? e.parameter : {};

  // Vérification de sécurité optionnelle via clé API
  if (API_KEY && API_KEY.trim() !== "") {
    const providedKey = params.key || params.token || "";
    if (providedKey !== API_KEY) {
      return jsonResponse({
        success: false,
        error: "Unauthorized: invalid or missing API key"
      }, 401);
    }
  }

  const action = (params.action || "all").toLowerCase();
  const responseData = {
    success: true,
    timestamp: new Date().toISOString()
  };

  try {
    if (action === "all" || action === "gmail") {
      responseData.gmail = getGmailUnread();
    }

    if (action === "all" || action === "calendar") {
      responseData.calendar = getTodayEvents();
    }

    return jsonResponse(responseData);
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error.toString()
    }, 500);
  }
}

/**
 * Récupère les 3 derniers fils de messages non lus de la boîte de réception.
 */
function getGmailUnread() {
  const threads = GmailApp.search("is:unread in:inbox", 0, 3);
  const emails = [];

  for (let i = 0; i < threads.length; i++) {
    const thread = threads[i];
    const messages = thread.getMessages();
    const lastMsg = messages[messages.length - 1];

    let sender = lastMsg.getFrom() || "Expéditeur";
    // Nettoyage de l'expéditeur : "Prénom Nom <email@domain.com>" -> "Prénom Nom"
    const nameMatch = sender.match(/^"?([^"<]+)"?\s*<.*>$/);
    if (nameMatch) {
      sender = nameMatch[1].trim();
    }

    emails.push({
      id: thread.getId(),
      title: sender,
      subtitle: thread.getFirstMessageSubject() || "(Sans objet)",
      snippet: thread.getSnippet() || "",
      date: lastMsg.getDate().toISOString(),
      url: "https://mail.google.com/mail/u/0/#inbox/" + thread.getId()
    });
  }

  return {
    totalUnread: GmailApp.getInboxUnreadCount(),
    items: emails
  };
}

/**
 * Récupère les événements du jour depuis le calendrier Google par défaut.
 */
function getTodayEvents() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  const cal = CalendarApp.getDefaultCalendar();
  const events = cal.getEvents(startOfDay, endOfDay);
  const upcomingEvents = [];

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const start = ev.getStartTime();
    const end = ev.getEndTime();

    // On ignore les événements déjà passés sauf s'ils durent toute la journée
    if (end < now && !ev.isAllDayEvent()) {
      continue;
    }

    const desc = ev.getDescription() || "";
    const loc = ev.getLocation() || "";
    const combinedText = desc + " " + loc;
    const videoMatch = combinedText.match(VIDEO_CONFERENCE_REGEX);
    let videoUrl = videoMatch ? videoMatch[0] : null;

    if (!videoUrl && typeof ev.getHangoutLink === "function") {
      try {
        const hangout = ev.getHangoutLink();
        if (hangout) videoUrl = hangout;
      } catch (e) {}
    }

    const diffMinutes = Math.round((start.getTime() - now.getTime()) / 60000);

    const timeStr = ev.isAllDayEvent()
      ? "Toute la journée"
      : Utilities.formatDate(start, Session.getScriptTimeZone(), "HH:mm") +
        " - " +
        Utilities.formatDate(end, Session.getScriptTimeZone(), "HH:mm");

    upcomingEvents.push({
      id: ev.getId(),
      title: ev.getTitle() || "Réunion",
      subtitle: timeStr,
      time: timeStr,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      videoUrl: videoUrl,
      isAllDay: ev.isAllDayEvent(),
      diffMinutes: diffMinutes,
      url: "https://calendar.google.com/calendar/r"
    });
  }

  // Trier par heure de début croissante
  upcomingEvents.sort(function(a, b) {
    return new Date(a.startTime) - new Date(b.startTime);
  });

  return {
    items: upcomingEvents
  };
}

function jsonResponse(data, statusCode) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
