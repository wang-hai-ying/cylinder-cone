import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// ==================== Tab Switching ====================
let currentTab = 'rotate';
document.getElementById('tabBar').addEventListener('click', (e) => {
  if (e.target.classList.contains('tab-btn')) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    currentTab = e.target.dataset.tab;
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.getElementById('panel-' + currentTab).classList.add('active');
    onTabSwitch(currentTab);
  }
});

// ==================== 面动成体 (Rotate-to-Solid) ====================
const sweepCanvas = document.getElementById('sweepCanvas');
const sweepScene = new THREE.Scene();
const sweepCamera = new THREE.PerspectiveCamera(50, 900 / 500, 0.1, 50);
const sweepRenderer = new THREE.WebGLRenderer({ canvas: sweepCanvas, alpha: true, antialias: true });
sweepRenderer.setSize(900, 500);
sweepRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

sweepCamera.position.set(8, 4, 10);
sweepCamera.lookAt(0, 0, 0);

// Grid
sweepScene.add(new THREE.GridHelper(10, 10, 0x444444, 0x222222));
sweepScene.background = new THREE.Color(0x1a1a2e);

// Lights
sweepScene.add(new THREE.AmbientLight(0x666666, 1.5));
const sweepDirLight = new THREE.DirectionalLight(0xffffff, 2);
sweepDirLight.position.set(5, 10, 8);
sweepScene.add(sweepDirLight);

// State
let sweepMode = 'cylinder'; // cylinder | cone
let sweepAngle = 0;
let sweepPlaying = false;
let sweepSpeed = 0.03;

// Shape (rotating face), Trail (result mesh), Axis line
let shapeGroup = new THREE.Group();
let trailGroup = new THREE.Group();
let axisLine;
sweepScene.add(shapeGroup);
sweepScene.add(trailGroup);

function createAxis(length = 8) {
  if (axisLine) sweepScene.remove(axisLine);
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, -length / 2, 0), new THREE.Vector3(0, length / 2, 0)
  ]);
  axisLine = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xff4444, linewidth: 2 }));
  sweepScene.add(axisLine);
}

function createSweepShape() {
  shapeGroup.clear();
  trailGroup.clear();

  if (sweepMode === 'cylinder') {
    // Rectangle: width=radius(3), height=5, rotating around Y axis at x=0
    const r = 3, h = 5;
    const rectGeo = new THREE.PlaneGeometry(r, h);
    const rectMat = new THREE.MeshBasicMaterial({ color: 0xf7971e, side: THREE.DoubleSide, transparent: true, opacity: 0.7 });
    const rect = new THREE.Mesh(rectGeo, rectMat);
    rect.position.set(r / 2, 0, 0);
    rect.rotation.y = 0;
    shapeGroup.add(rect);

    // Wireframe
    const wireGeo = new THREE.PlaneGeometry(r, h);
    const wireMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, wireframe: true, transparent: true, opacity: 0.5 });
    shapeGroup.add(new THREE.Mesh(wireGeo, wireMat).translateX(r / 2));

    // Result cylinder (initially invisible, revealed during sweep)
    const cylGeo = new THREE.CylinderGeometry(r, r, h, 48);
    const cylMat = new THREE.MeshPhongMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0, side: THREE.DoubleSide });
    const cylMesh = new THREE.Mesh(cylGeo, cylMat);
    cylMesh.name = 'trail';
    trailGroup.add(cylMesh);
  } else {
    // Right triangle: base=radius(3), height=5, rotating around Y axis
    const r = 3, h = 5;
    const triShape = new THREE.Shape();
    triShape.moveTo(0, -h / 2);
    triShape.lineTo(r, -h / 2);
    triShape.lineTo(0, h / 2);
    triShape.closePath();
    const triGeo = new THREE.ShapeGeometry(triShape);
    const triMat = new THREE.MeshBasicMaterial({ color: 0xf7971e, side: THREE.DoubleSide, transparent: true, opacity: 0.7 });
    const tri = new THREE.Mesh(triGeo, triMat);
    shapeGroup.add(tri);

    // Wire
    const wireGeo = new THREE.ShapeGeometry(triShape);
    shapeGroup.add(new THREE.Mesh(wireGeo, new THREE.MeshBasicMaterial({ color: 0xffaa00, wireframe: true, transparent: true, opacity: 0.5 })));

    // Result cone
    const coneGeo = new THREE.ConeGeometry(r, h, 48);
    const coneMat = new THREE.MeshPhongMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0, side: THREE.DoubleSide });
    const coneMesh = new THREE.Mesh(coneGeo, coneMat);
    coneMesh.name = 'trail';
    trailGroup.add(coneMesh);
  }
}

function buildTrail(currentAngle) {
  trailGroup.clear();
  const totalSteps = 72;
  const steps = Math.floor((currentAngle / (Math.PI * 2)) * totalSteps);
  const r = 3, h = 5;

  if (sweepMode === 'cylinder') {
    // Build partial cylinder from rotating lines
    const points = [];
    for (let i = 0; i <= Math.min(steps, totalSteps); i++) {
      const a = i * (Math.PI * 2) / totalSteps;
      points.push(new THREE.Vector3(r * Math.cos(a), -h / 2, r * Math.sin(a)));
      points.push(new THREE.Vector3(r * Math.cos(a), h / 2, r * Math.sin(a)));
    }
    for (let i = 1; i <= Math.min(steps, totalSteps); i++) {
      const idx = i * 2;
      // Each column line
      const lineGeo = new THREE.BufferGeometry().setFromPoints([points[idx - 2], points[idx - 1]]);
      trailGroup.add(new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.9 })));
    }
    // Top and bottom rings
    [h / 2, -h / 2].forEach(y => {
      const ringPts = [];
      for (let i = 0; i <= Math.min(steps, totalSteps); i++) {
        const a = i * (Math.PI * 2) / totalSteps;
        ringPts.push(new THREE.Vector3(r * Math.cos(a), y, r * Math.sin(a)));
      }
      if (ringPts.length > 1) {
        const ringGeo = new THREE.BufferGeometry().setFromPoints(ringPts);
        trailGroup.add(new THREE.Line(ringGeo, new THREE.LineBasicMaterial({ color: 0x81d4fa })));
      }
    });
  } else {
    // Build partial cone
    const points = [];
    for (let i = 0; i <= Math.min(steps, totalSteps); i++) {
      const a = i * (Math.PI * 2) / totalSteps;
      points.push(new THREE.Vector3(r * Math.cos(a), -h / 2, r * Math.sin(a)));
    }
    // Lines from base to apex
    for (let i = 0; i <= Math.min(steps, totalSteps); i++) {
      const a = i * (Math.PI * 2) / totalSteps;
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(r * Math.cos(a), -h / 2, r * Math.sin(a)),
        new THREE.Vector3(0, h / 2, 0)
      ]);
      trailGroup.add(new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.9 })));
    }
    // Base ring
    const ringPts = [];
    for (let i = 0; i <= Math.min(steps, totalSteps); i++) {
      const a = i * (Math.PI * 2) / totalSteps;
      ringPts.push(new THREE.Vector3(r * Math.cos(a), -h / 2, r * Math.sin(a)));
    }
    if (ringPts.length > 1) {
      const ringGeo = new THREE.BufferGeometry().setFromPoints(ringPts);
      trailGroup.add(new THREE.Line(ringGeo, new THREE.LineBasicMaterial({ color: 0x81d4fa })));
    }
  }
}

function toggleSweep() {
  sweepPlaying = !sweepPlaying;
  document.getElementById('sweepPlayBtn').textContent = sweepPlaying ? '⏸️ 暂停' : '▶️ 播放旋转动画';
  if (sweepPlaying) {
    sweepAngle = 0;
    buildTrail(0);
  }
}

function resetSweep() {
  sweepPlaying = false;
  sweepAngle = 0;
  document.getElementById('sweepPlayBtn').textContent = '▶️ 播放旋转动画';
  buildTrail(0);
  shapeGroup.rotation.y = 0;
}

function updateSweepSpeed() {
  sweepSpeed = parseFloat(document.getElementById('sweepSpeed').value) / 100;
}

// Mode buttons
document.querySelector('#panel-rotate .mode-switch').addEventListener('click', (e) => {
  if (e.target.classList.contains('mode-btn')) {
    document.querySelectorAll('#panel-rotate .mode-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    sweepMode = e.target.dataset.mode;
    resetSweep();
    createSweepShape();
    createAxis();
  }
});

createSweepShape();
createAxis();
updateSweepSpeed();

// ==================== 3D 探究 ====================
let exploreShape = 'cylinder';
const exploreCanvas = document.getElementById('exploreCanvas');
const exploreScene = new THREE.Scene();
const exploreCamera = new THREE.PerspectiveCamera(45, 800 / 500, 0.1, 50);
const exploreRenderer = new THREE.WebGLRenderer({ canvas: exploreCanvas, alpha: true, antialias: true });
exploreRenderer.setSize(800, 500);
exploreRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

exploreCamera.position.set(8, 5, 8);
exploreScene.add(new THREE.GridHelper(10, 10, 0x444444, 0x222222));
exploreScene.background = new THREE.Color(0x1a1a2e);
exploreScene.add(new THREE.AmbientLight(0x666666, 1.5));
const exploreDL = new THREE.DirectionalLight(0xffffff, 2);
exploreDL.position.set(5, 10, 8);
exploreScene.add(exploreDL);

const exploreGroup = new THREE.Group();
exploreScene.add(exploreGroup);

let exploreControls;

function buildExploreModel() {
  exploreGroup.clear();
  const r = parseFloat(document.getElementById('radiusInput').value) || 3;
  const h = parseFloat(document.getElementById('heightInput').value) || 5;

  if (exploreShape === 'cylinder') {
    const geo = new THREE.CylinderGeometry(r, r, h, 48);
    const mat = new THREE.MeshPhongMaterial({ color: 0xf7971e, specular: 0x222222, shininess: 30, side: THREE.DoubleSide });
    exploreGroup.add(new THREE.Mesh(geo, mat));
    // Wireframe overlay
    exploreGroup.add(new THREE.Mesh(
      new THREE.CylinderGeometry(r + 0.02, r + 0.02, h, 48),
      new THREE.MeshBasicMaterial({ color: 0x000000, wireframe: true, transparent: true, opacity: 0.3 })
    ));
  } else {
    const geo = new THREE.ConeGeometry(r, h, 48);
    const mat = new THREE.MeshPhongMaterial({ color: 0xf7971e, specular: 0x222222, shininess: 30, side: THREE.DoubleSide });
    exploreGroup.add(new THREE.Mesh(geo, mat));
    exploreGroup.add(new THREE.Mesh(
      new THREE.ConeGeometry(r + 0.02, h, 48),
      new THREE.MeshBasicMaterial({ color: 0x000000, wireframe: true, transparent: true, opacity: 0.3 })
    ));
  }

  // Update data display
  const pi = Math.PI;
  document.getElementById('valArea').textContent = (pi * r * r).toFixed(2);
  document.getElementById('valCircum').textContent = (2 * pi * r).toFixed(2);
  const lateral = exploreShape === 'cylinder' ? 2 * pi * r * h : pi * r * Math.sqrt(r * r + h * h);
  document.getElementById('valLateral').textContent = lateral.toFixed(2);
  const baseArea = pi * r * r;
  const surface = exploreShape === 'cylinder' ? 2 * baseArea + 2 * pi * r * h : baseArea + lateral;
  document.getElementById('valSurface').textContent = surface.toFixed(2);
  const volume = exploreShape === 'cylinder' ? pi * r * r * h : pi * r * r * h / 3;
  document.getElementById('valVolume').textContent = volume.toFixed(2);
}

function updateExploreParams() {
  document.getElementById('radiusSlider').value = document.getElementById('radiusInput').value;
  document.getElementById('radiusInput').value = document.getElementById('radiusSlider').value;
  document.getElementById('heightSlider').value = document.getElementById('heightInput').value;
  document.getElementById('heightInput').value = document.getElementById('heightSlider').value;
  buildExploreModel();
}

// Override so slider and input stay synced
['radius', 'height'].forEach(name => {
  document.getElementById(name + 'Slider').addEventListener('input', function () {
    document.getElementById(name + 'Input').value = this.value;
    buildExploreModel();
  });
  document.getElementById(name + 'Input').addEventListener('input', function () {
    let v = parseFloat(this.value);
    if (isNaN(v)) return;
    document.getElementById(name + 'Slider').value = v;
    buildExploreModel();
  });
});

document.querySelector('#panel-explore .mode-switch').addEventListener('click', (e) => {
  if (e.target.classList.contains('mode-btn')) {
    document.querySelectorAll('#panel-explore .mode-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    exploreShape = e.target.dataset.shape;
    buildExploreModel();
  }
});

buildExploreModel();

// ==================== 展开图 ====================
const unfoldCanvas = document.getElementById('unfoldCanvas');
const unfoldScene = new THREE.Scene();
const unfoldCamera = new THREE.PerspectiveCamera(50, 900 / 500, 0.1, 50);
const unfoldRenderer = new THREE.WebGLRenderer({ canvas: unfoldCanvas, alpha: true, antialias: true });
unfoldRenderer.setSize(900, 500);
unfoldRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

unfoldCamera.position.set(0, 8, 12);
unfoldCamera.lookAt(0, 0, 0);
unfoldScene.add(new THREE.GridHelper(12, 12, 0x444444, 0x222222));
unfoldScene.background = new THREE.Color(0x1a1a2e);
unfoldScene.add(new THREE.AmbientLight(0x666666, 1.5));
unfoldScene.add(new THREE.DirectionalLight(0xffffff, 2).position.set(5, 10, 8));

let unfoldMode = 'cylinder';
let unfoldProgress = 0;
let unfoldAnimTarget = 0;
const unfoldSolidGroup = new THREE.Group();
const unfoldFlatGroup = new THREE.Group();
unfoldScene.add(unfoldSolidGroup);
unfoldScene.add(unfoldFlatGroup);

function buildUnfoldScene() {
  unfoldSolidGroup.clear();
  unfoldFlatGroup.clear();
  const r = parseFloat(document.getElementById('unfoldRadiusInput').value) || 3;
  const h = parseFloat(document.getElementById('unfoldHeightInput').value) || 5;

  if (unfoldMode === 'cylinder') {
    // Solid cylinder at center
    const cylGeo = new THREE.CylinderGeometry(r, r, h, 48);
    const cylMat = new THREE.MeshPhongMaterial({ color: 0xf7971e, side: THREE.DoubleSide, transparent: true, opacity: 0.7 });
    unfoldSolidGroup.add(new THREE.Mesh(cylGeo, cylMat));
    // Wire
    unfoldSolidGroup.add(new THREE.Mesh(new THREE.CylinderGeometry(r + 0.03, r + 0.03, h, 48),
      new THREE.MeshBasicMaterial({ color: 0x000000, wireframe: true, transparent: true, opacity: 0.3 })));

    // Flat: two circles + rectangle (positioned to the right)
    const circGeo = new THREE.CylinderGeometry(r, r, 0.05, 48);
    const circMat = new THREE.MeshPhongMaterial({ color: 0x4fc3f7 });
    const c1 = new THREE.Mesh(circGeo, circMat);
    c1.position.set(4, h / 2, 0);
    unfoldFlatGroup.add(c1);
    const c2 = new THREE.Mesh(circGeo, circMat);
    c2.position.set(4, -h / 2, 0);
    unfoldFlatGroup.add(c2);

    // Rectangle (lateral surface)
    const rectW = 2 * Math.PI * r;
    const rectGeo = new THREE.PlaneGeometry(rectW, h);
    const rectMat = new THREE.MeshPhongMaterial({ color: 0xffd200, side: THREE.DoubleSide });
    const rect = new THREE.Mesh(rectGeo, rectMat);
    rect.position.set(4 + rectW / 2 + r + 0.5, 0, 0);
    unfoldFlatGroup.add(rect);
  } else {
    // Solid cone at center
    const coneGeo = new THREE.ConeGeometry(r, h, 48);
    const coneMat = new THREE.MeshPhongMaterial({ color: 0xf7971e, side: THREE.DoubleSide, transparent: true, opacity: 0.7 });
    unfoldSolidGroup.add(new THREE.Mesh(coneGeo, coneMat));
    unfoldSolidGroup.add(new THREE.Mesh(new THREE.ConeGeometry(r + 0.03, h, 48),
      new THREE.MeshBasicMaterial({ color: 0x000000, wireframe: true, transparent: true, opacity: 0.3 })));

    // Flat: circle + sector (positioned to the right)
    const circGeo = new THREE.CylinderGeometry(r, r, 0.05, 48);
    unfoldFlatGroup.add(new THREE.Mesh(circGeo, new THREE.MeshPhongMaterial({ color: 0x4fc3f7 })).translateX(5).translateY(-h / 2));

    // Sector approximated as a partial cone sliced flat
    const slant = Math.sqrt(r * r + h * h);
    const arcAngle = (2 * Math.PI * r) / slant; // radians
    const sectorGeo = new THREE.CircleGeometry(slant, 48, 0, arcAngle);
    const sectorMesh = new THREE.Mesh(sectorGeo, new THREE.MeshPhongMaterial({ color: 0xffd200, side: THREE.DoubleSide }));
    sectorMesh.rotation.x = -Math.PI / 2;
    sectorMesh.position.set(5 + slant + 1, 0, 0);
    unfoldFlatGroup.add(sectorMesh);
  }

  unfoldFlatGroup.visible = false;
  unfoldProgress = 0;
  unfoldAnimTarget = 0;
}

function toggleUnfold() {
  unfoldAnimTarget = unfoldAnimTarget > 0.5 ? 0 : 1;
  document.getElementById('unfoldBtn').textContent = unfoldAnimTarget > 0.5 ? '📦 还原' : '📐 展开';
}

function resetUnfold() {
  unfoldAnimTarget = 0;
  unfoldProgress = 0;
  document.getElementById('unfoldBtn').textContent = '📐 展开';
}

function updateUnfoldParams() {
  document.getElementById('unfoldRadiusSlider').value = document.getElementById('unfoldRadiusInput').value;
  document.getElementById('unfoldRadiusInput').value = document.getElementById('unfoldRadiusSlider').value;
  document.getElementById('unfoldHeightSlider').value = document.getElementById('unfoldHeightInput').value;
  document.getElementById('unfoldHeightInput').value = document.getElementById('unfoldHeightSlider').value;
  buildUnfoldScene();
}

['unfoldRadius', 'unfoldHeight'].forEach(name => {
  document.getElementById(name + 'Slider').addEventListener('input', function () {
    document.getElementById(name + 'Input').value = this.value;
    buildUnfoldScene();
  });
  document.getElementById(name + 'Input').addEventListener('input', function () {
    document.getElementById(name + 'Slider').value = this.value;
    buildUnfoldScene();
  });
});

document.querySelector('#panel-unfold .mode-switch').addEventListener('click', (e) => {
  if (e.target.classList.contains('mode-btn')) {
    document.querySelectorAll('#panel-unfold .mode-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    unfoldMode = e.target.dataset.unfold;
    buildUnfoldScene();
  }
});

buildUnfoldScene();

// ==================== 体积关系 ====================
const volumeCanvas = document.getElementById('volumeCanvas');
const volScene = new THREE.Scene();
const volCamera = new THREE.PerspectiveCamera(45, 900 / 500, 0.1, 50);
const volRenderer = new THREE.WebGLRenderer({ canvas: volumeCanvas, alpha: true, antialias: true });
volRenderer.setSize(900, 500);
volRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

volCamera.position.set(4, 5, 10);
volCamera.lookAt(0, 0, 0);
volScene.add(new THREE.GridHelper(10, 10, 0x444444, 0x222222));
volScene.background = new THREE.Color(0x1a1a2e);
volScene.add(new THREE.AmbientLight(0x666666, 1.5));
volScene.add(new THREE.DirectionalLight(0xffffff, 2).position.set(5, 10, 8));

const volGroup = new THREE.Group();
volScene.add(volGroup);

function buildVolumeScene() {
  volGroup.clear();
  const r = parseFloat(document.getElementById('volRadiusInput').value) || 3;
  const h = parseFloat(document.getElementById('volHeightInput').value) || 5;

  // Cylinder on the left
  const cylGeo = new THREE.CylinderGeometry(r, r, h, 48);
  const cylMat = new THREE.MeshPhongMaterial({ color: 0xf7971e, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
  const cyl = new THREE.Mesh(cylGeo, cylMat);
  cyl.position.set(-r - 1, 0, 0);
  volGroup.add(cyl);
  volGroup.add(new THREE.Mesh(new THREE.CylinderGeometry(r + 0.03, r + 0.03, h, 48),
    new THREE.MeshBasicMaterial({ color: 0x000000, wireframe: true, transparent: true, opacity: 0.25 })).translateX(-r - 1));

  // Cone on the right
  const coneGeo = new THREE.ConeGeometry(r, h, 48);
  const coneMat = new THREE.MeshPhongMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.position.set(r + 1, 0, 0);
  volGroup.add(cone);
  volGroup.add(new THREE.Mesh(new THREE.ConeGeometry(r + 0.03, h, 48),
    new THREE.MeshBasicMaterial({ color: 0x000000, wireframe: true, transparent: true, opacity: 0.25 })).translateX(r + 1));

  // Labels
  const pi = Math.PI;
  const cylVol = pi * r * r * h;
  const coneVol = cylVol / 3;

  document.getElementById('valCylVol').textContent = cylVol.toFixed(2);
  document.getElementById('valConeVol').textContent = coneVol.toFixed(2);
  document.getElementById('valRatio').textContent = (cylVol / coneVol).toFixed(2) + ' : 1';
}

function updateVolumeParams() {
  document.getElementById('volRadiusSlider').value = document.getElementById('volRadiusInput').value;
  document.getElementById('volRadiusInput').value = document.getElementById('volRadiusSlider').value;
  document.getElementById('volHeightSlider').value = document.getElementById('volHeightInput').value;
  document.getElementById('volHeightInput').value = document.getElementById('volHeightSlider').value;
  buildVolumeScene();
}

['volRadius', 'volHeight'].forEach(name => {
  document.getElementById(name + 'Slider').addEventListener('input', function () {
    document.getElementById(name + 'Input').value = this.value;
    buildVolumeScene();
  });
  document.getElementById(name + 'Input').addEventListener('input', function () {
    document.getElementById(name + 'Slider').value = this.value;
    buildVolumeScene();
  });
});

buildVolumeScene();

// ==================== 数据记录 ====================
let volRecords = [];

function addVolRecord() {
  const r = parseFloat(document.getElementById('volRadiusInput').value) || 3;
  const h = parseFloat(document.getElementById('volHeightInput').value) || 5;
  const pi = Math.PI;
  const base = pi * r * r;
  const cylV = base * h;
  const coneV = cylV / 3;
  volRecords.push({ r, h, base, cylV, coneV });
  renderVolRecords();
}

function renderVolRecords() {
  const tbody = document.getElementById('recordTbody');
  if (volRecords.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="color:#666;padding:30px;">在"体积关系"中调整半径和高后，点击记录</td></tr>';
    return;
  }
  tbody.innerHTML = volRecords.map((v, i) => {
    const r2 = (v.r * v.r).toFixed(2);
    const vr2 = (v.cylV / (v.r * v.r)).toFixed(2);
    return `<tr><td>${i + 1}</td><td>${v.r.toFixed(1)}</td><td>${v.h.toFixed(1)}</td>
      <td>${v.base.toFixed(2)}</td><td style="color:#ffd200;">${v.cylV.toFixed(2)}</td>
      <td style="color:#4fc3f7;">${v.coneV.toFixed(2)}</td>
      <td>${(v.cylV / v.coneV).toFixed(2)}:1</td><td>${r2}</td><td>${vr2}</td></tr>`;
  }).join('');
}

function clearVolRecords() { volRecords = []; renderVolRecords(); }

function revealVolKnowledge() {
  document.getElementById('knowledgeReveal2').style.display = 'block';
  document.getElementById('revealBtn2').style.display = 'none';
}

// ==================== 闯关游戏 ====================
let gameScore2 = 0, gameTotal2 = 0, answered2 = false, currentQ2 = null;

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function shuffle(arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function generateVolQuestion() {
  const types = [1, 2, 3, 4];
  for (let t = 0; t < 50; t++) {
    const type = types[Math.floor(Math.random() * types.length)];
    let q = null;

    if (type === 1) {
      // 已知 r, h，求圆柱体积
      const r = randInt(1, 8), h = randInt(2, 10);
      const answer = Math.round(Math.PI * r * r * h * 100) / 100;
      const wrongs = [];
      for (let i = 0; i < 3; i++) wrongs.push(Math.round((answer + randInt(-8, 8) * randInt(1, 3)) * 100) / 100);
      const opts = Array.from(new Set([answer, ...wrongs].filter(v => v > 0))).slice(0, 4);
      if (opts.length < 4) continue;
      q = { text: `底面半径 <b>${r}</b> cm，高 <b>${h}</b> cm 的圆柱，体积是多少 cm³？（π≈3.14）`, answer, type: 'number', options: shuffle(opts) };
    } else if (type === 2) {
      // 已知 r, h，求圆锥体积
      const r = randInt(1, 6), h = randInt(3, 12);
      const answer = Math.round(Math.PI * r * r * h / 3 * 100) / 100;
      const wrongs = [];
      for (let i = 0; i < 3; i++) {
        let w = Math.round((answer + randInt(-5, 5) * randInt(1, 3)) * 100) / 100;
        if (w <= 0) w = Math.round(answer * randInt(2, 5) * 100) / 100;
        wrongs.push(w);
      }
      const opts = Array.from(new Set([answer, ...wrongs].filter(v => v > 0))).slice(0, 4);
      if (opts.length < 4) continue;
      q = { text: `底面半径 <b>${r}</b> cm，高 <b>${h}</b> cm 的圆锥，体积是多少 cm³？（π≈3.14）`, answer, type: 'number', options: shuffle(opts) };
    } else if (type === 3) {
      // 已知圆柱体积，r 或 h，求另一个
      const r = randInt(2, 6), h = randInt(2, 8);
      const v = Math.round(Math.PI * r * r * h * 100) / 100;
      const askR = Math.random() > 0.5;
      if (askR) {
        const answer = r;
        const wrongs = [r + randInt(1, 3), Math.max(1, r - randInt(1, 2)), r + randInt(3, 5)];
        const opts = Array.from(new Set([answer, ...wrongs])).slice(0, 4);
        if (opts.length < 4) continue;
        q = { text: `圆柱体积 <b>${v.toFixed(2)}</b> cm³，高 <b>${h}</b> cm。底面半径约是多少 cm？（π≈3.14）`, answer, type: 'int', options: shuffle(opts) };
      } else {
        const answer = h;
        const wrongs = [h + randInt(1, 4), Math.max(1, h - randInt(1, 3)), h + randInt(4, 7)];
        const opts = Array.from(new Set([answer, ...wrongs])).slice(0, 4);
        if (opts.length < 4) continue;
        q = { text: `圆柱体积 <b>${v.toFixed(2)}</b> cm³，底面半径 <b>${r}</b> cm。高约是多少 cm？（π≈3.14）`, answer, type: 'int', options: shuffle(opts) };
      }
    } else {
      // 判断题：等底等高圆柱vs圆锥
      const r = randInt(2, 7), h = randInt(3, 9);
      const cylV = Math.round(Math.PI * r * r * h * 100) / 100;
      const correct = Math.round(cylV / 3 * 100) / 100;
      const wrong = Math.round(cylV * 2 / 3 * 100) / 100;
      q = { text: `底面半径 <b>${r}</b> cm，高 <b>${h}</b> cm 的圆锥，体积是？<br>（提示：等底等高圆柱体积是 <b>${cylV.toFixed(2)}</b> cm³）`, answer: correct, type: 'number', options: shuffle([correct, wrong, Math.round(cylV * 0.4 * 100) / 100, Math.round(cylV * 0.25 * 100) / 100]) };
    }
    if (q && q.options.length >= 4) return q;
  }
  return { text: '底面半径 3 cm，高 5 cm 的圆柱体积是多少？（π≈3.14）', answer: 141.3, type: 'number', options: shuffle([141.3, 47.1, 94.2, 282.6]) };
}

function startVolGame() {
  gameScore2 = 0; gameTotal2 = 0;
  document.getElementById('gameScore').textContent = '0';
  document.getElementById('gameTotal').textContent = '0';
  document.getElementById('startGameBtn2').style.display = 'none';
  document.getElementById('nextGameBtn2').style.display = 'inline-block';
  nextVolQuestion();
}

function nextVolQuestion() {
  answered2 = false;
  currentQ2 = generateVolQuestion();
  document.getElementById('gameQuestion').innerHTML = currentQ2.text;
  document.getElementById('gameFeedback').innerHTML = '';
  document.getElementById('gameOptions').innerHTML = currentQ2.options.map((opt, i) => {
    const unit = currentQ2.type === 'int' ? ' cm' : ' cm³';
    const label = typeof opt === 'number' ? (opt === Math.floor(opt) ? opt + unit : opt.toFixed(2).replace(/\.?0+$/, '') + unit) : opt;
    return `<button class="game-option" onclick="answerVolQ(${i}, this)">${label}</button>`;
  }).join('');
}

function answerVolQ(idx, btnEl) {
  if (answered2) return;
  answered2 = true;
  gameTotal2++;
  const userAnswer = currentQ2.options[idx];
  const answer = currentQ2.answer;
  const isCorrect = Math.abs(userAnswer - answer) < 0.01;

  if (isCorrect) {
    gameScore2++;
    btnEl.classList.add('correct');
    document.getElementById('gameFeedback').innerHTML = '✅ 正确！';
  } else {
    btnEl.classList.add('wrong');
    document.querySelectorAll('.game-option').forEach((b, i) => {
      if (Math.abs(currentQ2.options[i] - answer) < 0.01) b.classList.add('correct');
    });
    document.getElementById('gameFeedback').innerHTML = '❌ 再想想！';
  }
  document.getElementById('gameScore').textContent = gameScore2;
  document.getElementById('gameTotal').textContent = gameTotal2;
  document.querySelectorAll('.game-option').forEach(b => b.style.pointerEvents = 'none');
}

// ==================== DOM Event Bindings (for module scope) ====================
document.getElementById('sweepPlayBtn').addEventListener('click', toggleSweep);
document.getElementById('sweepSpeed').addEventListener('input', updateSweepSpeed);
document.getElementById('unfoldBtn').addEventListener('click', toggleUnfold);
document.getElementById('startGameBtn2').addEventListener('click', startVolGame);
document.getElementById('nextGameBtn2').addEventListener('click', nextVolQuestion);
document.getElementById('revealBtn2').addEventListener('click', revealVolKnowledge);

// Reset buttons
document.querySelectorAll('#panel-rotate .btn-outline').forEach(b => b.addEventListener('click', resetSweep));
const unfoldResetBtns = document.querySelectorAll('#panel-unfold .btn-outline');
if (unfoldResetBtns.length > 0) unfoldResetBtns[0].addEventListener('click', resetUnfold);

// ==================== Global animation loop ====================
function animate(time) {
  requestAnimationFrame(animate);

  if (currentTab === 'rotate') {
    if (sweepPlaying && sweepAngle < Math.PI * 2.1) {
      sweepAngle += sweepSpeed;
      shapeGroup.rotation.y = sweepAngle;
      buildTrail(sweepAngle);
      if (sweepAngle >= Math.PI * 2) {
        sweepPlaying = false;
        sweepAngle = Math.PI * 2;
        document.getElementById('sweepPlayBtn').textContent = '▶️ 播放旋转动画';
        buildTrail(Math.PI * 2);
      }
    }
    sweepRenderer.render(sweepScene, sweepCamera);
  } else if (currentTab === 'explore') {
    if (!exploreControls) {
      exploreControls = new OrbitControls(exploreCamera, exploreRenderer.domElement);
      exploreControls.enableDamping = true;
      exploreControls.dampingFactor = 0.1;
      exploreControls.autoRotate = true;
      exploreControls.autoRotateSpeed = 1;
    }
    exploreControls.update();
    exploreRenderer.render(exploreScene, exploreCamera);
  } else if (currentTab === 'unfold') {
    if (Math.abs(unfoldProgress - unfoldAnimTarget) > 0.001) {
      unfoldProgress += (unfoldAnimTarget - unfoldProgress) * 0.06;
      unfoldSolidGroup.scale.setScalar(1 - unfoldProgress);
      unfoldFlatGroup.scale.setScalar(unfoldProgress);
      unfoldFlatGroup.visible = unfoldProgress > 0.01;
      unfoldSolidGroup.visible = unfoldProgress < 0.99;
    }
    unfoldRenderer.render(unfoldScene, unfoldCamera);
  } else if (currentTab === 'volume') {
    // Slow auto-rotate
    volGroup.rotation.y += 0.005;
    volRenderer.render(volScene, volCamera);
  }

  // Clean up controls when not on explore tab
  if (currentTab !== 'explore' && exploreControls) {
    exploreControls.dispose();
    exploreControls = null;
  }
}

function onTabSwitch(tab) {
  // Trigger resize for canvas in new tab
  setTimeout(resizeAllCanvases, 50);
}

function resizeAllCanvases() {
  const pairs = [
    [sweepCanvas, sweepRenderer, 900, 500],
    [exploreCanvas, exploreRenderer, 800, 500],
    [unfoldCanvas, unfoldRenderer, 900, 500],
    [volumeCanvas, volRenderer, 900, 500]
  ];
  pairs.forEach(([canvas, renderer, w, h]) => {
    const parent = canvas.parentElement;
    if (!parent) return;
    const maxW = Math.min(parent.clientWidth - 32, w);
    const scale = maxW / w;
    canvas.style.width = maxW + 'px';
    canvas.style.height = (h * scale) + 'px';
    renderer.setSize(maxW, h * scale, false);
  });
}

window.addEventListener('resize', resizeAllCanvases);
resizeAllCanvases();

// Start
requestAnimationFrame(animate);

// Expose for inline onclick (module scope)
window.toggleSweep = toggleSweep;
window.resetSweep = resetSweep;
window.updateSweepSpeed = updateSweepSpeed;
window.updateExploreParams = updateExploreParams;
window.toggleUnfold = toggleUnfold;
window.resetUnfold = resetUnfold;
window.updateUnfoldParams = updateUnfoldParams;
window.updateVolumeParams = updateVolumeParams;
window.addVolRecord = addVolRecord;
window.clearVolRecords = clearVolRecords;
window.revealVolKnowledge = revealVolKnowledge;
window.startVolGame = startVolGame;
window.nextVolQuestion = nextVolQuestion;
window.answerVolQ = answerVolQ;
