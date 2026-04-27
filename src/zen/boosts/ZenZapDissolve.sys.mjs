/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export class ZapDissolve {
  FRAG = `
precision mediump float;
uniform sampler2D u_DissolveTexture;
varying vec2 v_PCoord;
varying float v_PLifetime;
varying float v_POpacity;

void main() {
    if(v_PLifetime >= 1.0) discard;

    vec4 sampled = texture2D(u_DissolveTexture, v_PCoord);
    if(sampled.a == 0.0) discard;

    float distToCenter = distance(vec2(0.5, 0.5), gl_PointCoord);
    if(distToCenter > 0.5) discard;

    float alpha = sampled.a * v_POpacity;
    float brightnessFactor = 1.5;
    gl_FragColor = vec4(sampled.rgb * brightnessFactor, alpha);
}
  `;

  VERT = `
precision highp float;

uniform float u_AnimationDuration;
uniform float u_ParticleSize;
uniform float u_ElapsedTime;
uniform float u_ViewportWidth;
uniform float u_ViewportHeight;
uniform float u_TextureWidth;
uniform float u_TextureHeight;
uniform float u_TextureLeft;
uniform float u_TextureTop;

attribute float a_ParticleIndex;

varying vec2  v_PCoord;
varying float v_PLifetime;
varying float v_POpacity;

float hash1(float n) { return fract(sin(n) * 100000.0); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123); }
float hash3(vec2 p, float offset) { 
    return fract(sin(dot(p, vec2(12.9898 + offset, 78.233 - offset))) * 43758.5453123); 
}

/* coordinates */
vec2 toNDC(vec2 pixel) {
  vec2 ndc;
  ndc.x = (pixel.x / u_ViewportWidth) * 2.0 - 1.0;
  ndc.y = 1.0 - (pixel.y / u_ViewportHeight) * 2.0;
  return ndc;
}

float mix1(float a, float b, float t) { return a + (b - a) * t; }

/* particle layout */
vec2 particlePixelPos(float index) {
  float cols = floor(u_TextureWidth / u_ParticleSize);
  if(cols < 1.0) cols = 1.0;
  float row = floor(index / cols);
  float col = index - row * cols;
  return vec2(
    (col + 0.5) * u_ParticleSize + u_TextureLeft,
    (row + 0.5) * u_ParticleSize + u_TextureTop
  );
}

mat2 rotate2D(float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return mat2(c, -s, s, c);
}

/* motion */
vec4 animatedPosition(vec2 pixelPos, float seed, float seed2, float seed3, float t) {
  vec2 base = toNDC(pixelPos);
  
  // Random rotation
  float rotation1 = (seed - 0.5) * 0.52; // 15 * 2 * (π/180)
  float rotation2 = (seed2 - 0.5) * 0.52;
  
  // Random translation
  float randomRadian = 6.28318 * (seed3 - 0.5);
  float translateX = 60.0 * cos(randomRadian) / u_ViewportWidth * 2.0;
  float translateY = 30.0 * sin(randomRadian) / u_ViewportHeight * 2.0;
  vec2 rotated1 = rotate2D(rotation1 * t) * base;
  
  vec2 translated = vec2(
    mix1(rotated1.x, rotated1.x + translateX, t),
    mix1(rotated1.y, rotated1.y + translateY, t)
  );
  
  vec2 finalPos = rotate2D(rotation2 * t) * (translated - base) + base;
  
  return vec4(finalPos, 0.0, 1.0);
}

void main() {
  vec2 pixelPos = particlePixelPos(a_ParticleIndex);
  
  // Multiple seeds for different random values
  float seed = hash2(pixelPos);
  float seed2 = hash3(pixelPos, 1.0);
  float seed3 = hash3(pixelPos, 2.0);

  float normalizedX = (pixelPos.x - u_TextureLeft) / u_TextureWidth;
  float frameAssignment = (seed + 2.0 * normalizedX) / 3.0;
  float maxDelay = u_AnimationDuration * 0.42;
  float delay = frameAssignment * maxDelay;
  float particleDuration = u_AnimationDuration - delay;
  float lifetime = clamp((u_ElapsedTime - delay) / particleDuration, 0.0, 1.0);
  float easedT = 1.0 - pow(1.0 - lifetime, 3.0);

  gl_Position  = animatedPosition(pixelPos, seed, seed2, seed3, easedT);
  gl_PointSize = u_ParticleSize;

  v_PLifetime = lifetime;
  v_POpacity = 1.0 - lifetime;

  // Texture coordinates
  float cols = floor(u_TextureWidth / u_ParticleSize);
  if(cols < 1.0) cols = 1.0;
  
  float row = floor(a_ParticleIndex / cols);
  float col = a_ParticleIndex - row * cols;
  
  v_PCoord = vec2(
    (col + 0.5) / cols,
    (row + 0.5) / floor(u_TextureHeight / u_ParticleSize)
  );
}
  `;

  window = null;
  document = null;
  #initialized = false;
  #content = null;

  #webglContext = null;
  #program;
  #animationStartTime = -1;
  #particlesCount = 0;
  #duration = 1400;
  #texture = null;
  #buffer = null;

  #hasTriggered = false;
  #rafId = null;

  #onComplete = null;

  /**
   * @param {Document} document Webpage document
   */
  constructor(document) {
    if (!document) {
      return;
    }
    this.document = document;
    this.window = document.ownerGlobal;
  }

  /**
   * Initializes the zap mode and inserts anonymous content
   */
  async initialize() {
    if (this.#initialized) {
      return;
    }

    this.#content = this.document.insertAnonymousContent();
    this.#content.root.appendChild(this.fragment);
    await this.#initializeElements();

    this.#initialized = true;
  }

  /**
   * Initializes the elements and contexts required for the rendering
   */
  async #initializeElements() {
    const canvas = this.getElementById("zen-zap-dissolve-canvas");
    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
    });
    this.#webglContext = gl;

    if (!gl) {
      console.error("WebGL is not supported.");
      return;
    }

    this.#resizeCanvasToClientSize(canvas);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    // Ensure viewport is set correctly
    gl.viewport(0, 0, canvas.width, canvas.height);

    this.#program = await this.#createProgram(gl, this.VERT, this.FRAG);
  }

  /**
   * Resizes the canvas to the correct size
   *
   * @param {Element} canvas
   */
  #resizeCanvasToClientSize(canvas) {
    const width = this.window.innerWidth;
    const height = this.window.innerHeight;

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;

      // Set the WebGL viewport to match the canvas size
      if (this.#webglContext) {
        this.#webglContext.viewport(0, 0, width, height);
      }
    }
  }

  /**
   * Creates the canvas program
   *
   * @param {object} gl WebGL context
   * @param {string} vertContent Content of the vertex shader
   * @param {string} fragContent Content of the fragment shader
   * @returns {*} The WebGL program
   */
  async #createProgram(gl, vertContent, fragContent) {
    const vertexShader = this.#compileShader(gl, vertContent, gl.VERTEX_SHADER);
    const fragmentShader = this.#compileShader(
      gl,
      fragContent,
      gl.FRAGMENT_SHADER
    );

    if (!vertexShader || !fragmentShader) {
      console.error(
        "Program creation aborted: One or more shaders failed to compile."
      );
      return null;
    }

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    gl.detachShader(program, vertexShader);
    gl.detachShader(program, fragmentShader);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(
        "Shader program initializiation failure:",
        gl.getProgramInfoLog(program)
      );
    }

    return program;
  }

  /**
   * Compiles a shader
   *
   * @param {object} gl WebGL context
   * @param {string} source Shader source
   * @param {object} type Shader type
   * @returns {*} The compiled shader
   */
  #compileShader(gl, source, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error("Shader compilation failure:", gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  /**
   * Retreives image data from a given image
   *
   * @param {Image} image The image
   * @returns {ImageData} Image data
   */
  #getImageData(image) {
    const canvas = this.getElementById(
      "zen-zap-dissolve-canvas"
    ).ownerDocument.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;

    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0);
    return context.getImageData(0, 0, canvas.width, canvas.height);
  }

  /**
   * Creates and loads a WebGL texture from an Image
   *
   * @param {Image} image The target image
   */
  #loadTexture(image) {
    if (this.#texture) {
      this.#webglContext.deleteTexture(this.#texture);
    }

    const texture = this.#webglContext.createTexture();
    this.#webglContext.activeTexture(this.#webglContext.TEXTURE0);
    this.#webglContext.bindTexture(this.#webglContext.TEXTURE_2D, texture);

    this.#webglContext.texParameteri(
      this.#webglContext.TEXTURE_2D,
      this.#webglContext.TEXTURE_WRAP_S,
      this.#webglContext.CLAMP_TO_EDGE
    );
    this.#webglContext.texParameteri(
      this.#webglContext.TEXTURE_2D,
      this.#webglContext.TEXTURE_WRAP_T,
      this.#webglContext.CLAMP_TO_EDGE
    );
    this.#webglContext.texParameteri(
      this.#webglContext.TEXTURE_2D,
      this.#webglContext.TEXTURE_MIN_FILTER,
      this.#webglContext.NEAREST
    );
    this.#webglContext.texParameteri(
      this.#webglContext.TEXTURE_2D,
      this.#webglContext.TEXTURE_MAG_FILTER,
      this.#webglContext.NEAREST
    );

    if (
      image &&
      image instanceof Ci.nsIImageLoadingContent &&
      image.width &&
      image.height
    ) {
      this.#webglContext.texImage2D(
        this.#webglContext.TEXTURE_2D,
        0,
        this.#webglContext.RGBA,
        this.#webglContext.RGBA,
        this.#webglContext.UNSIGNED_BYTE,
        image
      );
    } else {
      const imageData = this.#getImageData(image);
      this.#webglContext.texImage2D(
        this.#webglContext.TEXTURE_2D,
        0,
        this.#webglContext.RGBA,
        imageData.width,
        imageData.height,
        0,
        this.#webglContext.RGBA,
        this.#webglContext.UNSIGNED_BYTE,
        imageData.data
      );
    }

    const textureLocation = this.#webglContext.getUniformLocation(
      this.#program,
      "u_DissolveTexture"
    );
    this.#webglContext.uniform1i(textureLocation, 0);
    this.#texture = texture;
  }

  /**
   * Binds the parameters to the program for a given Element
   *
   * @param {Element} element
   */
  #bindParameters(element) {
    const gl = this.#webglContext;
    const rect = element.getBoundingClientRect();
    const particleSize = 1;

    const textureWidth = rect.width;
    const textureHeight = rect.height;

    const cols = Math.floor(textureWidth / particleSize);
    const rows = Math.floor(textureHeight / particleSize);
    this.#particlesCount = cols * rows;

    gl.useProgram(this.#program);

    this.#setUniform1f("u_AnimationDuration", this.#duration);
    this.#setUniform1f("u_ParticleSize", particleSize);
    this.#setUniform1f("u_ViewportWidth", this.window.innerWidth);
    this.#setUniform1f("u_ViewportHeight", this.window.innerHeight);
    this.#setUniform1f("u_TextureWidth", textureWidth);
    this.#setUniform1f("u_TextureHeight", textureHeight);

    this.#setUniform1f("u_TextureLeft", rect.left);
    this.#setUniform1f("u_TextureTop", rect.top);

    const indices = new Float32Array(this.#particlesCount);
    for (let i = 0; i < this.#particlesCount; i++) {
      indices[i] = i;
    }

    if (this.#buffer) {
      gl.deleteBuffer(this.#buffer);
    }

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    const aLoc = gl.getAttribLocation(this.#program, "a_ParticleIndex");
    gl.enableVertexAttribArray(aLoc);
    gl.vertexAttribPointer(aLoc, 1, gl.FLOAT, false, 0, 0);

    this.#buffer = buffer;
  }

  /**
   * Requests an animation frame
   */
  #requestDraw() {
    this.#rafId = this.window.requestAnimationFrame(t => this.#draw(t));
  }

  /**
   * Helper function for setting a uniform in the WebGL context
   *
   * @param {string} name The property name
   * @param {*} value The property value
   */
  #setUniform1f(name, value) {
    const loc = this.#webglContext.getUniformLocation(this.#program, name);
    this.#webglContext.uniform1f(loc, value);
  }

  /**
   * Renders the output to a canvas
   *
   * @param {number} time The frametime
   */
  #draw(time) {
    const gl = this.#webglContext;
    gl.useProgram(this.#program);

    if (this.#animationStartTime === -1) {
      this.#animationStartTime = time;
    }

    const elapsed = time - this.#animationStartTime;
    if (elapsed > this.#duration) {
      this.#resetForNextRun();
      return;
    }

    gl.clear(gl.COLOR_BUFFER_BIT);
    this.#setUniform1f("u_ElapsedTime", elapsed);

    gl.drawArrays(gl.POINTS, 0, this.#particlesCount);
    this.#requestDraw();
  }

  /**
   * Displays a dissolve effect for the element
   *
   * @param {Element} element The element to dissolve
   * @param {Function} onComplete Callback for when the animation is complete
   */
  dissolve(element, onComplete) {
    if (!this.#initialized || this.#hasTriggered || !element) {
      return;
    }
    this.#hasTriggered = true;

    this.#onComplete = onComplete;

    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      console.warn("[ZapDissolve]: element has zero size. Skipping dissolve");
      return;
    }

    const captureCanvas = this.document.createElement("canvas");
    captureCanvas.width = rect.width;
    captureCanvas.height = rect.height;
    const ctx = captureCanvas.getContext("2d");

    const canvas = this.getElementById("zen-zap-dissolve-canvas");
    this.#resizeCanvasToClientSize(canvas);

    ctx.drawWindow(
      this.window,
      rect.left + this.window.scrollX,
      rect.top + this.window.scrollY,
      rect.width,
      rect.height,
      "rgba(0,0,0,0)"
    );

    this.#loadTexture(captureCanvas);
    this.#bindParameters(element);

    this.#animationStartTime = -1;
    this.#requestDraw();
  }

  get content() {
    if (!this.#content || Cu.isDeadWrapper(this.#content)) {
      return null;
    }
    return this.#content;
  }

  /**
   * Helper for getting an anonymous element by id
   *
   * @param {string} id The id of the element
   */
  getElementById(id) {
    return this.content.root.getElementById(id);
  }

  get markup() {
    return `
    <template>
      <link rel="stylesheet" href="chrome://browser/content/zen-styles/content/zen-zap.css" />
      <canvas id="zen-zap-dissolve-canvas"></canvas>
    </template>
    `;
  }

  get fragment() {
    if (!this.template) {
      let parser = new DOMParser();
      let doc = parser.parseFromString(this.markup, "text/html");
      this.template = this.document.importNode(
        doc.querySelector("template"),
        true
      );
    }
    let fragment = this.template.content.cloneNode(true);
    return fragment;
  }

  /**
   * Makes the class ready for reusage
   */
  #resetForNextRun() {
    const gl = this.#webglContext;
    if (gl) {
      if (this.#texture) {
        gl.deleteTexture(this.#texture);
        this.#texture = null;
      }
      if (this.#buffer) {
        gl.deleteBuffer(this.#buffer);
        this.#buffer = null;
      }

      gl.clear(gl.COLOR_BUFFER_BIT);
    }

    this.#hasTriggered = false;
    this.#animationStartTime = -1;

    if (this.#rafId) {
      this.window.cancelAnimationFrame(this.#rafId);
      this.#rafId = null;
    }

    if (this.#onComplete) {
      this.#onComplete();
      this.#onComplete = null;
    }
  }

  /**
   * Removes all event listeners and removes the overlay from the Anonymous Content
   */
  tearDown() {
    const gl = this.#webglContext;
    if (gl) {
      if (this.#texture) {
        gl.deleteTexture(this.#texture);
        this.#texture = null;
      }
      if (this.#buffer) {
        gl.deleteBuffer(this.#buffer);
        this.#buffer = null;
      }

      if (this.#program) {
        gl.deleteProgram(this.#program);
        this.#program = null;
      }

      const loseCtx = gl.getExtension("WEBGL_lose_context");
      loseCtx?.loseContext();
    }

    if (this.window != null) {
      this.window.cancelAnimationFrame(this.#rafId);
    }
    this.#rafId = null;

    if (this.#content) {
      try {
        this.document.removeAnonymousContent(this.#content);
      } catch {
        /* This might fail but that's not an issue */
      }
    }

    this.#content = null;
    this.#initialized = false;
  }
}
