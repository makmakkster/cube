/* ============================================================
   Портфель · 3D — прототип визуализации структуры активов
   Three.js (классическая сборка). Открывается двойным кликом.
   Материал сегментов: глянцевое «стекло» со скруглёнными
   рёбрами и fresnel-свечением (по референсу).
   ============================================================ */
(function () {
'use strict';

/* ------------------------------------------------------------
   1. Данные портфеля — 10 инструментов, веса в сумме 100%
   ------------------------------------------------------------ */
var INSTRUMENTS = [
  { ticker:'AAPL',  name:'Apple',      weight:18, price:245.30, change: 1.24, color:'#A2AAB3', logo:'AA' },
  { ticker:'MSFT',  name:'Microsoft',  weight:14, price:512.80, change: 0.62, color:'#00A4EF', logo:'MS' },
  { ticker:'NVDA',  name:'NVIDIA',     weight:12, price:148.60, change:-1.85, color:'#76B900', logo:'NV' },
  { ticker:'AMZN',  name:'Amazon',     weight:11, price:228.45, change: 0.94, color:'#FF9900', logo:'AM' },
  { ticker:'GOOGL', name:'Alphabet',   weight:10, price:199.10, change: 1.10, color:'#4285F4', logo:'GO' },
  { ticker:'META',  name:'Meta',       weight: 9, price:640.25, change: 2.31, color:'#0668E1', logo:'ME' },
  { ticker:'TSLA',  name:'Tesla',      weight: 8, price:342.70, change:-3.42, color:'#E82127', logo:'TS' },
  { ticker:'JPM',   name:'JPMorgan',   weight: 7, price:268.90, change: 0.35, color:'#6E4B9E', logo:'JP' },
  { ticker:'V',     name:'Visa',       weight: 6, price:315.40, change: 0.48, color:'#F7B500', logo:'V'  },
  { ticker:'WMT',   name:'Walmart',    weight: 5, price:108.75, change:-0.27, color:'#00A7A7', logo:'WM' }
];

var NOTIONAL = 1000000;   // условная стоимость портфеля
var CUBE_SIZE = 2.6;      // сторона большого куба
var SHRINK = 0.958;       // зазор между внутренними блоками
var EXPLODE = (window.innerWidth <= 720) ? 1.6 : 1.95;   // на телефоне разлёт компактнее

/* Уважение к настройке «уменьшить движение» */
var REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
/* Есть ли мышка (для hover-подсказок; на тач-экранах они не нужны) */
var FINE = !!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches);

/* ------------------------------------------------------------
   2. Сцена
   ------------------------------------------------------------ */
var canvas = document.getElementById('scene');
/* на телефоне ограничиваем плотность пикселей ради плавности */
var PR = Math.min(window.devicePixelRatio, (window.innerWidth <= 720 ? 1.5 : 2));
var renderer = new THREE.WebGLRenderer({ canvas:canvas, antialias:true, alpha:true });
renderer.setPixelRatio(PR);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(42, window.innerWidth/window.innerHeight, 0.1, 200);
camera.position.set(4.1, 3.4, 5.2);

var controls = new THREE.OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.05;     // ниже значение — вязче и инертнее
controls.rotateSpeed = 0.62;        // нужно чуть больше «усилия»
controls.zoomSpeed = 0.7;
controls.minDistance = 3.2;
controls.maxDistance = 16;
controls.enablePan = false;
controls.autoRotate = !REDUCED;
controls.autoRotateSpeed = 0.45;

var HOME_POS = new THREE.Vector3(4.9, 3.5, 5.3);
var HOME_TARGET = new THREE.Vector3(0.85, 0, 0);
if (window.innerWidth <= 720){
  /* телефон: отодвигаем камеру и поднимаем куб над нижней панелью */
  HOME_POS.set(5.6, 4.3, 6.8);
  HOME_TARGET.set(0, -0.3, 0);
} else if (window.innerWidth <= 1000){
  HOME_POS.set(4.1, 3.4, 5.2);
  HOME_TARGET.set(0, 0, 0);
}
camera.position.copy(HOME_POS);
controls.target.copy(HOME_TARGET);
controls.update();

/* ---------- Окружение для отражений (глянец) ---------- */
function makeEnvTexture(){
  var c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  var x = c.getContext('2d');
  var g = x.createLinearGradient(0,0,0,256);
  g.addColorStop(0,'#1c3d68');
  g.addColorStop(.5,'#0a1526');
  g.addColorStop(1,'#04060c');
  x.fillStyle = g; x.fillRect(0,0,512,256);

  var spot = x.createRadialGradient(150,64,4,150,64,130);
  spot.addColorStop(0,'rgba(233,244,255,.95)');
  spot.addColorStop(1,'rgba(233,244,255,0)');
  x.fillStyle = spot; x.fillRect(0,0,512,256);

  var cyan = x.createRadialGradient(392,182,4,392,182,150);
  cyan.addColorStop(0,'rgba(79,200,239,.75)');
  cyan.addColorStop(1,'rgba(79,200,239,0)');
  x.fillStyle = cyan; x.fillRect(0,0,512,256);

  var t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.encoding = THREE.sRGBEncoding;
  return t;
}
var envRT = null;
(function buildEnv(){
  var pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  envRT = pmrem.fromEquirectangular(makeEnvTexture());
  scene.environment = envRT.texture;
  pmrem.dispose();
})();

/* ---------- Свет: холодный ключевой + cyan-контровой ---------- */
scene.add(new THREE.HemisphereLight(0xbcd2ff, 0x060a12, 0.32));

var key = new THREE.DirectionalLight(0xeaf3ff, 1.15);
key.position.set(5, 8, 6);
scene.add(key);

var fill = new THREE.DirectionalLight(0x5f8dff, 0.6);
fill.position.set(-7, -2, -6);
scene.add(fill);

var rim = new THREE.PointLight(0x4fc8ef, 1.0, 34);
rim.position.set(-4, 4, -6);
scene.add(rim);

/* ---------- Пыль в пространстве (глубина) ---------- */
(function dust(){
  var N = 700, pos = new Float32Array(N*3);
  for (var i=0;i<N;i++){
    var r = 9 + Math.random()*18;
    var t = Math.random()*Math.PI*2;
    var p = Math.acos(2*Math.random()-1);
    pos[i*3]   = r*Math.sin(p)*Math.cos(t);
    pos[i*3+1] = r*Math.cos(p)*0.7;
    pos[i*3+2] = r*Math.sin(p)*Math.sin(t);
  }
  var g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos,3));
  var m = new THREE.PointsMaterial({ color:0x9fb6d6, size:0.032, transparent:true, opacity:0.42, depthWrite:false });
  var pts = new THREE.Points(g,m);
  pts.name = 'dust';
  scene.add(pts);
})();

/* ------------------------------------------------------------
   3. Текстуры граней: логотип эмитента + цена акции
      (тёмно-синяя «плитка» со свечением бренда)
   ------------------------------------------------------------ */
var MAX_ANISO = renderer.capabilities.getMaxAnisotropy();
var FONT_UI   = 'Manrope,"Segoe UI",Arial,sans-serif';
var FONT_MONO = '"JetBrains Mono",ui-monospace,Consolas,monospace';

function hexToRgb(hex){
  var h = hex.replace('#','');
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}
function rgba(hex,a){ var c=hexToRgb(hex); return 'rgba('+c[0]+','+c[1]+','+c[2]+','+a+')'; }
function lighten(hex,k){
  var c=hexToRgb(hex), f=function(v){ return Math.round(v+(255-v)*k); };
  return 'rgb('+f(c[0])+','+f(c[1])+','+f(c[2])+')';
}
function roundRect(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}
function canvasTexture(cv){
  var t = new THREE.CanvasTexture(cv);
  t.encoding = THREE.sRGBEncoding;
  t.anisotropy = MAX_ANISO;
  return t;
}
function baseTile(ctx, S, inst, glowStrength){
  var bg = ctx.createLinearGradient(0,0,0,S);
  bg.addColorStop(0,'#0d1c33');
  bg.addColorStop(1,'#060c18');
  ctx.fillStyle = bg; ctx.fillRect(0,0,S,S);

  /* техническая сетка */
  ctx.save();
  ctx.strokeStyle = 'rgba(120,180,255,.06)';
  ctx.lineWidth = 1;
  for (var g=64; g<S; g+=64){
    ctx.beginPath(); ctx.moveTo(g,0); ctx.lineTo(g,S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,g); ctx.lineTo(S,g); ctx.stroke();
  }
  ctx.restore();

  /* свечение бренда */
  var glow = ctx.createRadialGradient(S/2, S*0.30, 8, S/2, S*0.30, S*0.82);
  glow.addColorStop(0, rgba(inst.color, glowStrength));
  glow.addColorStop(1, rgba(inst.color, 0));
  ctx.fillStyle = glow; ctx.fillRect(0,0,S,S);

  /* верхний глянцевый блик */
  var top = ctx.createLinearGradient(0,0,0,S*0.42);
  top.addColorStop(0,'rgba(255,255,255,.10)');
  top.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle = top; ctx.fillRect(0,0,S,S*0.42);
}
function makeSideTexture(inst){
  var S = 512;
  var cv = document.createElement('canvas'); cv.width = cv.height = S;
  var ctx = cv.getContext('2d');
  baseTile(ctx, S, inst, .30);

  /* рамка */
  ctx.strokeStyle = rgba(inst.color,.55);
  ctx.lineWidth = 8;
  roundRect(ctx, 14, 14, S-28, S-28, 34); ctx.stroke();

  /* логотип-эмблема */
  var cx = S/2, cy = S*0.315, r = S*0.115;
  var ring = ctx.createLinearGradient(cx-r, cy-r, cx+r, cy+r);
  ring.addColorStop(0, lighten(inst.color,.30));
  ring.addColorStop(1, inst.color);
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
  ctx.fillStyle = ring; ctx.fill();
  ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.stroke();

  ctx.save();
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.clip();
  var sh = ctx.createLinearGradient(0,cy-r,0,cy+r);
  sh.addColorStop(0,'rgba(255,255,255,.38)');
  sh.addColorStop(.55,'rgba(255,255,255,0)');
  ctx.fillStyle = sh; ctx.fillRect(cx-r,cy-r,r*2,r*2);
  ctx.restore();

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 ' + (inst.logo.length>1 ? r*0.92 : r*1.15) + 'px ' + FONT_UI;
  ctx.fillText(inst.logo, cx, cy+r*0.06);

  /* тикер + название */
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 54px ' + FONT_UI;
  ctx.fillText(inst.ticker, S/2, S*0.60);

  ctx.fillStyle = 'rgba(170,190,220,.72)';
  ctx.font = '500 22px ' + FONT_UI;
  ctx.fillText(inst.name.toUpperCase(), S/2, S*0.665);

  /* цена акции */
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 50px ' + FONT_MONO;
  ctx.fillText('$' + inst.price.toFixed(2), S/2, S*0.80);

  /* изменение и вес */
  var up = inst.change >= 0;
  ctx.fillStyle = up ? '#3FE0A0' : '#FF6B82';
  ctx.font = '600 28px ' + FONT_MONO;
  ctx.fillText((up?'+':'−') + Math.abs(inst.change).toFixed(2) + '%  ·  ' + inst.weight + '%', S/2, S*0.885);

  return canvasTexture(cv);
}
function makeTopTexture(inst){
  var S = 512, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  var ctx = cv.getContext('2d');

  var bg = ctx.createLinearGradient(0,0,0,S);
  bg.addColorStop(0,'#0e2038');
  bg.addColorStop(1,'#081222');
  ctx.fillStyle = bg; ctx.fillRect(0,0,S,S);

  var glow = ctx.createRadialGradient(S/2,S/2,10,S/2,S/2,S*0.62);
  glow.addColorStop(0, rgba(inst.color,.62));
  glow.addColorStop(1, rgba(inst.color,0));
  ctx.fillStyle = glow; ctx.fillRect(0,0,S,S);

  var streak = ctx.createLinearGradient(0,0,S,S);
  streak.addColorStop(0,'rgba(255,255,255,.16)');
  streak.addColorStop(.5,'rgba(255,255,255,0)');
  ctx.fillStyle = streak; ctx.fillRect(0,0,S,S);

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,.22)';
  ctx.font = '800 200px ' + FONT_UI;
  ctx.fillText(inst.logo, S/2, S/2 + 6);

  ctx.strokeStyle = rgba(inst.color,.5);
  ctx.lineWidth = 8;
  roundRect(ctx, 14, 14, S-28, S-28, 34); ctx.stroke();

  return canvasTexture(cv);
}
function makeBottomTexture(inst){
  var S = 256, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  var ctx = cv.getContext('2d');
  var bg = ctx.createLinearGradient(0,0,0,S);
  bg.addColorStop(0,'#08111f');
  bg.addColorStop(1,'#050a13');
  ctx.fillStyle = bg; ctx.fillRect(0,0,S,S);
  var glow = ctx.createRadialGradient(S/2,S/2,4,S/2,S/2,S*0.6);
  glow.addColorStop(0, rgba(inst.color,.16));
  glow.addColorStop(1, rgba(inst.color,0));
  ctx.fillStyle = glow; ctx.fillRect(0,0,S,S);
  return canvasTexture(cv);
}
function makeTextureSet(inst){
  return { side: makeSideTexture(inst), top: makeTopTexture(inst), bot: makeBottomTexture(inst) };
}

/* ------------------------------------------------------------
   4. Разбиение куба на блоки с объёмом ∝ весу инструмента
   ------------------------------------------------------------ */
function balancedSplit(list){
  var sorted = list.slice().sort(function(a,b){ return b.w - a.w; });
  var a=[], b=[], sa=0, sb=0;
  for (var i=0;i<sorted.length;i++){
    if (sa <= sb){ a.push(sorted[i]); sa += sorted[i].w; }
    else         { b.push(sorted[i]); sb += sorted[i].w; }
  }
  return { a:a, b:b };
}
function partitionBox(weights, size){
  var out = [];
  recurse({ c:[0,0,0], s:[size,size,size] }, weights.map(function(w,i){ return { i:i, w:w }; }));
  return out;

  function recurse(box, list){
    if (list.length === 1){
      out.push({ index:list[0].i, center:box.c.slice(), size:box.s.slice() });
      return;
    }
    var axis = 0;
    if (box.s[1] > box.s[axis]) axis = 1;
    if (box.s[2] > box.s[axis]) axis = 2;

    var total = list.reduce(function(s,x){ return s + x.w; }, 0);
    var parts = balancedSplit(list);
    var wA = parts.a.reduce(function(s,x){ return s + x.w; }, 0);
    var fA = wA / total;

    var sA = box.s.slice(), sB = box.s.slice();
    sA[axis] = box.s[axis] * fA;
    sB[axis] = box.s[axis] - sA[axis];

    var lo = box.c[axis] - box.s[axis]/2;
    var cA = box.c.slice(); cA[axis] = lo + sA[axis]/2;
    var cB = box.c.slice(); cB[axis] = lo + sA[axis] + sB[axis]/2;

    recurse({ c:cA, s:sA }, parts.a);
    recurse({ c:cB, s:sB }, parts.b);
  }
}

/* ------------------------------------------------------------
   5. Материал «стекло» + fresnel-свечение (halo)
   ------------------------------------------------------------ */
var HALO_VS =
  'varying vec3 vN;\nvarying vec3 vV;\n' +
  'void main(){\n' +
  '  vec4 mv = modelViewMatrix * vec4(position,1.0);\n' +
  '  vN = normalize(normalMatrix * normal);\n' +
  '  vV = normalize(-mv.xyz);\n' +
  '  gl_Position = projectionMatrix * mv;\n' +
  '}';
var HALO_FS =
  'uniform vec3 uColor;\nuniform float uPower;\nuniform float uIntensity;\n' +
  'varying vec3 vN;\nvarying vec3 vV;\n' +
  'void main(){\n' +
  '  float f = pow(1.0 - clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0), uPower);\n' +
  '  gl_FragColor = vec4(uColor * f * uIntensity, f);\n' +
  '}';
function makeHaloMaterial(color){
  return new THREE.ShaderMaterial({
    uniforms:{
      uColor:{ value:new THREE.Color(color) },
      uPower:{ value:2.4 },
      uIntensity:{ value:0.85 }
    },
    vertexShader: HALO_VS,
    fragmentShader: HALO_FS,
    transparent:true,
    blending:THREE.AdditiveBlending,
    depthWrite:false
  });
}

/* ------------------------------------------------------------
   6. Сборка блоков
   ------------------------------------------------------------ */
var group = new THREE.Group();
scene.add(group);

var cells = partitionBox(INSTRUMENTS.map(function(i){ return i.weight; }), CUBE_SIZE);
var meshes = [];

cells.forEach(function(cell){
  var inst = INSTRUMENTS[cell.index];

  var w = cell.size[0]*SHRINK, h = cell.size[1]*SHRINK, d = cell.size[2]*SHRINK;
  var rad = Math.min(w, h, d) * 0.16;
  var geo = new THREE.RoundedBoxGeometry(w, h, d, 3, rad);

  /* явные группы граней: 0 right · 1 left · 2 top · 3 bottom · 4 front · 5 back */
  geo.clearGroups();
  var perFace = geo.attributes.position.count / 6;
  for (var side=0; side<6; side++) geo.addGroup(side*perFace, perFace, side);

  var set = makeTextureSet(inst);

  function glass(tex, intensity){
    return new THREE.MeshPhysicalMaterial({
      map: tex,
      emissive: 0xffffff,
      emissiveMap: tex,
      emissiveIntensity: intensity,
      roughness: 0.28,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.22,
      reflectivity: 0.5,
      envMapIntensity: 1.0
    });
  }
  var matSide = glass(set.side, 0.18);
  var matTop  = glass(set.top,  0.30);
  var matBot  = glass(set.bot,  0.12);

  var mesh = new THREE.Mesh(geo, [matSide, matSide, matTop, matBot, matSide, matSide]);
  var base = new THREE.Vector3(cell.center[0], cell.center[1], cell.center[2]);
  mesh.position.copy(base);

  /* свечение по контуру */
  var halo = new THREE.Mesh(geo, makeHaloMaterial(inst.color));
  halo.scale.setScalar(1.055);
  halo.renderOrder = 2;
  mesh.add(halo);

  mesh.userData = {
    index: cell.index,
    base: base,
    target: base.clone(),
    exploded: base.clone().multiplyScalar(EXPLODE),
    mats: [matSide, matTop, matBot],
    halo: halo
  };

  group.add(mesh);
  meshes.push(mesh);
});

/* Призрачный контур исходного куба — виден после разбора */
var ghost = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE)),
  new THREE.LineBasicMaterial({ color:0x4fc8ef, transparent:true, opacity:0.13 })
);
ghost.visible = false;
group.add(ghost);

/* ------------------------------------------------------------
   7. Режимы: собранный куб / разобранные блоки
   ------------------------------------------------------------ */
var mode = 'assembled';
var dragging = null;
var spinning = null;         // блок, который продолжает вращаться по инерции
var spinVX = 0, spinVY = 0;  // угловая скорость
var down = null;
var focusIndex = -1;
var lastX = 0, lastY = 0;
var tip = document.getElementById('tip');

function setMode(next){
  mode = next;
  var exploded = (mode === 'exploded');
  dragging = null;
  spinning = null; spinVX = spinVY = 0;
  meshes.forEach(function(m){
    m.userData.target.copy(exploded ? m.userData.exploded : m.userData.base);
    m.userData.settle = !exploded;   // при сборке доворачиваем блок ровно
  });
  ghost.visible = exploded;
  modeBtn.textContent = exploded ? 'Собрать куб' : 'Разобрать куб';
  updateHint();
  stopAutoRotate();
}

function updateHint(){
  hint.textContent = (mode === 'assembled')
    ? 'Кликните по кубу — он разберётся на инструменты. Тяните фон, чтобы вращать.'
    : 'Тяните блок, чтобы раскрутить, — дальше он крутится по инерции. Клик по пустоте — собрать.';
}

/* Автоповорот при простое */
var idleTimer = null;
function stopAutoRotate(){
  controls.autoRotate = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(function(){ if (!dragging && !REDUCED) controls.autoRotate = true; }, 7000);
}

/* ------------------------------------------------------------
   8. Управление мышью / касанием (вязкое, с инерцией)
   ------------------------------------------------------------ */
var raycaster = new THREE.Raycaster();
var pointer = new THREE.Vector2();
var tmpScale = new THREE.Vector3();
var IDENTITY = new THREE.Quaternion();
var ROT_SENS = 0.0095;      // «вес» вращения: меньше — нужно больше усилия
var SPIN_DECAY = 0.945;     // вязкое затухание инерции
var AXIS_X = new THREE.Vector3(1,0,0);
var AXIS_Y = new THREE.Vector3(0,1,0);
var tmpQ = new THREE.Quaternion();

function rotateBy(mesh, rx, ry){
  tmpQ.setFromAxisAngle(AXIS_Y, rx); mesh.quaternion.premultiply(tmpQ);
  tmpQ.setFromAxisAngle(AXIS_X, ry); mesh.quaternion.premultiply(tmpQ);
}
function toPointer(e){
  var r = canvas.getBoundingClientRect();
  pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
}
function pick(){
  raycaster.setFromCamera(pointer, camera);
  var hit = raycaster.intersectObjects(meshes, false)[0];
  return hit ? hit.object : null;
}

document.addEventListener('pointerdown', function(e){
  if (e.target.closest && e.target.closest('.ui, .scrim')) return;

  toPointer(e);
  var hit = pick();
  down = { x:e.clientX, y:e.clientY, moved:false, hit:hit };
  lastX = e.clientX; lastY = e.clientY;

  if (mode === 'exploded' && hit){
    dragging = hit;
    spinning = null; spinVX = spinVY = 0;
    controls.enabled = false;
    if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
    controls.autoRotate = false;
  }
}, true);

window.addEventListener('pointermove', function(e){
  if (down && Math.hypot(e.clientX-down.x, e.clientY-down.y) > 5) down.moved = true;

  if (dragging){
    var dx = e.clientX - lastX;
    var dy = e.clientY - lastY;
    var rx = dx * ROT_SENS;
    var ry = dy * ROT_SENS;
    rotateBy(dragging, rx, ry);
    /* сглаженная угловая скорость для инерции после отпускания */
    spinVX = spinVX * 0.55 + rx * 0.45;
    spinVY = spinVY * 0.55 + ry * 0.45;
    dragging.userData.settle = false;
    lastX = e.clientX; lastY = e.clientY;
    canvas.style.cursor = 'grabbing';
    return;
  }

  /* hover-подсказки только для мыши, не для тач-экранов */
  if (!down && FINE && e.pointerType !== 'touch'){
    toPointer(e);
    var hit = pick();
    focusIndex = hit ? hit.userData.index : -1;
    canvas.style.cursor = hit ? (mode === 'exploded' ? 'grab' : 'pointer') : 'grab';
    if (hit) showTip(e, INSTRUMENTS[hit.userData.index]);
    else hideTip();
  }
});

function endPointer(){
  if (dragging){
    if (!REDUCED && (Math.abs(spinVX) > 0.0012 || Math.abs(spinVY) > 0.0012)){
      spinning = dragging;   // отпустили — вращение продолжается по инерции
    }
    dragging = null;
    controls.enabled = true;
    canvas.style.cursor = 'grab';
    stopAutoRotate();
  }
  if (down && !down.moved){
    if (mode === 'assembled'){
      if (down.hit) setMode('exploded');
    } else {
      if (!down.hit) setMode('assembled');
      else focusIndex = down.hit.userData.index;   // тап по блоку — подсветка
    }
  }
  down = null;
  lastX = lastY = 0;
}
window.addEventListener('pointerup', endPointer);
window.addEventListener('pointercancel', endPointer);

/* Тултип у курсора */
function showTip(e, inst){
  var up = inst.change >= 0;
  tip.innerHTML = '<b>' + inst.ticker + '</b> ' +
    '<span class="num" style="color:var(--muted)">$' + inst.price.toFixed(2) + '</span> ' +
    '<span class="num" style="color:' + (up ? '#3FE0A0' : '#FF6B82') + '">' + (up?'+':'−') +
    Math.abs(inst.change).toFixed(2) + '%</span>' +
    '<br><span style="color:var(--muted)">' + inst.name + ' · <span class="num">' + inst.weight + '%</span> портфеля</span>';
  var pad = 16;
  var x = e.clientX + pad, y = e.clientY + pad;
  if (x + tip.offsetWidth > window.innerWidth - 8) x = e.clientX - tip.offsetWidth - pad;
  if (y + tip.offsetHeight > window.innerHeight - 8) y = e.clientY - tip.offsetHeight - pad;
  tip.style.left = x + 'px';
  tip.style.top  = y + 'px';
  tip.classList.add('show');
}
function hideTip(){ tip.classList.remove('show'); }

/* ------------------------------------------------------------
   9. Панель состава портфеля + сводка
   ------------------------------------------------------------ */
var panelList = document.getElementById('panelList');
var maxWeight = Math.max.apply(null, INSTRUMENTS.map(function(i){ return i.weight; }));

INSTRUMENTS.forEach(function(inst, i){
  var up = inst.change >= 0;
  var row = document.createElement('button');
  row.className = 'row';
  row.dataset.index = i;
  row.innerHTML =
    '<span class="chip" style="background:' + inst.color + '"></span>' +
    '<span class="meta">' +
      '<span class="row-top">' +
        '<span class="ticker">' + inst.ticker + '</span>' +
        '<span class="name">' + inst.name + '</span>' +
        '<span class="wtag">' + inst.weight + '%</span>' +
      '</span>' +
      '<span class="bar"><i style="width:' + (inst.weight/maxWeight*100).toFixed(0) + '%;background:' + inst.color + '"></i></span>' +
    '</span>' +
    '<span class="row-num">' +
      '<span class="row-price">$' + inst.price.toFixed(2) + '</span>' +
      '<span class="row-chg ' + (up?'up':'down') + '">' + (up?'+':'−') + Math.abs(inst.change).toFixed(2) + '%</span>' +
    '</span>';

  row.addEventListener('mouseenter', function(){ focusIndex = i; });
  row.addEventListener('mouseleave', function(){ if (focusIndex === i) focusIndex = -1; });
  row.addEventListener('click', function(){
    focusIndex = i;
    if (mode === 'assembled') setMode('exploded');
    if (window.innerWidth <= 900) setPanelOpen(false);
  });
  panelList.appendChild(row);
});

var rows = [].slice.call(panelList.querySelectorAll('.row'));
var lastFocus = -2;

var totalValueEl  = document.getElementById('totalValue');
var totalChangeEl = document.getElementById('totalChange');
document.getElementById('totalCount').textContent = INSTRUMENTS.length;

var weightedChange = INSTRUMENTS.reduce(function(s,i){ return s + i.weight*i.change; }, 0) / 100;
totalValueEl.textContent = '$' + NOTIONAL.toLocaleString('ru-RU');
totalChangeEl.textContent = (weightedChange >= 0 ? '+' : '−') + Math.abs(weightedChange).toFixed(2) + '%';
totalChangeEl.className = 'stat-value mono ' + (weightedChange >= 0 ? 'up' : 'down');
document.getElementById('panelMeta').textContent = INSTRUMENTS.length + ' позиций';

/* ------------------------------------------------------------
   10. Элементы управления
   ------------------------------------------------------------ */
var modeBtn = document.getElementById('modeBtn');
var hint = document.getElementById('hint');

var panelToggleEl = document.getElementById('panelToggle');
var scrimEl = document.getElementById('scrim');
function setPanelOpen(open){
  document.body.classList.toggle('panel-open', open);
  panelToggleEl.setAttribute('aria-expanded', open ? 'true' : 'false');
}
modeBtn.addEventListener('click', function(){ setMode(mode === 'assembled' ? 'exploded' : 'assembled'); });
panelToggleEl.addEventListener('click', function(){ setPanelOpen(!document.body.classList.contains('panel-open')); });
document.getElementById('panelClose').addEventListener('click', function(){ setPanelOpen(false); });
scrimEl.addEventListener('click', function(){ setPanelOpen(false); });

window.addEventListener('keydown', function(e){
  if (e.code === 'Space'){ e.preventDefault(); setMode(mode === 'assembled' ? 'exploded' : 'assembled'); }
  if (e.key === 'r' || e.key === 'R'){ camera.position.copy(HOME_POS); controls.target.copy(HOME_TARGET); }
});

/* ------------------------------------------------------------
   11. Обновление текстур после загрузки шрифтов
   ------------------------------------------------------------ */
function applyTexture(mat, tex){
  if (mat.map) mat.map.dispose();
  mat.map = tex;
  mat.emissiveMap = tex;
  mat.needsUpdate = true;
}
function refreshTextures(){
  for (var i=0;i<meshes.length;i++){
    var inst = INSTRUMENTS[meshes[i].userData.index];
    var mats = meshes[i].userData.mats;
    var set = makeTextureSet(inst);
    applyTexture(mats[0], set.side);
    applyTexture(mats[1], set.top);
    applyTexture(mats[2], set.bot);
  }
}
if (document.fonts && document.fonts.ready){
  document.fonts.ready.then(function(){ try { refreshTextures(); } catch(e){} });
}

/* ------------------------------------------------------------
   12. Цикл рендера
   ------------------------------------------------------------ */
updateHint();

var introScale = REDUCED ? 1 : 0.82;
var dust = scene.getObjectByName('dust');

function animate(){
  requestAnimationFrame(animate);
  var t = performance.now() * 0.001;

  /* плавное появление */
  introScale += (1 - introScale) * 0.06;
  group.scale.setScalar(introScale);

  /* инерция вращения блока после отпускания */
  if (spinning){
    if (Math.abs(spinVX) < 0.0004 && Math.abs(spinVY) < 0.0004){
      spinning = null; spinVX = spinVY = 0;
    } else {
      rotateBy(spinning, spinVX, spinVY);
      spinVX *= SPIN_DECAY;
      spinVY *= SPIN_DECAY;
      spinning.userData.settle = false;
    }
  }

  for (var i=0;i<meshes.length;i++){
    var m = meshes[i];
    m.position.lerp(m.userData.target, 0.14);

    /* доворот в исходную ориентацию после сборки */
    if (m.userData.settle && m !== dragging){
      m.quaternion.slerp(IDENTITY, 0.16);
      if (m.quaternion.angleTo(IDENTITY) < 0.003){
        m.quaternion.copy(IDENTITY);
        m.userData.settle = false;
      }
    }

    var focus = (m.userData.index === focusIndex);
    var s = focus ? 1.06 : 1;
    tmpScale.set(s,s,s);
    m.scale.lerp(tmpScale, 0.16);

    var mats = m.userData.mats;
    for (var k=0;k<mats.length;k++){
      var base = (k === 1) ? 0.30 : ((k === 2) ? 0.12 : 0.18);
      var target = focus ? base + 0.30 : base;
      mats[k].emissiveIntensity += (target - mats[k].emissiveIntensity) * 0.16;
    }
    if (focus){
      m.userData.halo.material.uniforms.uIntensity.value +=
        (1.35 - m.userData.halo.material.uniforms.uIntensity.value) * 0.16;
    } else {
      m.userData.halo.material.uniforms.uIntensity.value +=
        (0.85 - m.userData.halo.material.uniforms.uIntensity.value) * 0.16;
    }
  }

  if (dust && !REDUCED){ dust.rotation.y = t * 0.02; dust.rotation.x = Math.sin(t*0.05) * 0.05; }

  if (lastFocus !== focusIndex){
    lastFocus = focusIndex;
    for (var j=0;j<rows.length;j++) rows[j].classList.toggle('active', j === focusIndex);
  }

  controls.update();
  renderer.render(scene, camera);
}
animate();

/* ------------------------------------------------------------
   13. Ресайз
   ------------------------------------------------------------ */
window.addEventListener('resize', function(){
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, (window.innerWidth <= 720 ? 1.5 : 2)));
});

})();
