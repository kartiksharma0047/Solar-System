import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/Addons.js";
import config from "./config.json";
import Stars from "url:../assets/Stars.webp";
import Sun from "url:../assets/Sun.webp";
import Mercury from "url:../assets/Mercury.webp";
import Venus from "url:../assets/Venus.webp";
import Mars from "url:../assets/Mars.webp";
import Earth from "url:../assets/Earth.webp";
import Jupiter from "url:../assets/Jupiter.webp";
import Saturn from "url:../assets/Saturn.webp";
import SaturnRing from "url:../assets/Saturn_Ring.webp";
import Uranus from "url:../assets/Uranus.webp";
import Neptune from "url:../assets/Neptune.webp";
import Pluto from "url:../assets/Pluto.webp";
import * as dat from "dat.gui";
import { gsap } from "gsap";

const textureMap = {
  Sun,
  Mercury,
  Venus,
  Mars,
  Earth,
  Jupiter,
  Saturn,
  SaturnRing,
  Uranus,
  Neptune,
  Pluto,
};

const renderer = new THREE.WebGLRenderer();

renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);

const orbit = new OrbitControls(camera, renderer.domElement);

camera.position.set(-90, 140, 140);
orbit.update();

// As We want hover and Click feature
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
window.addEventListener("mousemove", (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

const ambientLight = new THREE.AmbientLight(0x333333);
scene.add(ambientLight);

// Add 3D Background
const cubeTextureLoader = new THREE.CubeTextureLoader();
scene.background = cubeTextureLoader.load([
  Stars,
  Stars,
  Stars,
  Stars,
  Stars,
  Stars,
]);

const textureLoader = new THREE.TextureLoader();

// Solor System Dynamic Logic
const objects = [];
const orbitLines = [];
let sun = null;
const appState = {
  mode: "solar",
  selected: null,
};

// GUI
const gui = new dat.GUI();
const options = {
  Orbital_Lines: true,
  OrbitSpeed: 1,
};

gui.add(options, "Orbital_Lines").onChange((value) => {
  orbitLines.forEach((line) => {
    line.visible = value;
  });
});
gui.add(options, "OrbitSpeed", 0.25, 5, 0.25);

config.configs.map((item) => {
  const geometry = new THREE.SphereGeometry(
    item.radius,
    item.width_Segment,
    item.height_Segment,
  );
  let material;
  if (item.type === "Star") {
    material = new THREE.MeshBasicMaterial({
      map: textureLoader.load(textureMap[item.Load_Img]),
    });
  } else {
    material = new THREE.MeshStandardMaterial({
      map: textureLoader.load(textureMap[item.Load_Img]),
    });
  }
  const mesh = new THREE.Mesh(geometry, material);
  if (item.type === "Star") {
    sun = mesh;
    scene.add(sun);
    objects.push({
      mesh: sun,
      rotationSpeed: item.rotateY,
      details: item.details,
    });
  }

  if (item.type === "Planet") {
    if (!sun) {
      console.error("Sun must be defined before planets");
      return;
    }

    scene.add(mesh);

    const a = item.orbit?.a || item.Distance_from_star;
    const b = item.orbit?.b || item.Distance_from_star;

    const points = [];
    const segments = 128;

    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;

      points.push(
        new THREE.Vector3(Math.cos(theta) * a, 0, Math.sin(theta) * b),
      );
    }

    const orbitGeometry = new THREE.BufferGeometry().setFromPoints(points);

    const orbitMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.4,
    });

    const orbitLine = new THREE.Line(orbitGeometry, orbitMaterial);
    scene.add(orbitLine);
    orbitLines.push(orbitLine);

    if (item.ring_Config) {
      const ringData = item.ring_Config;

      // Ring geometry (innerRadius, outerRadius)
      const ringGeometry = new THREE.RingGeometry(
        ringData.inner_radius,
        ringData.outer_radius,
        ringData.theta_Segment,
      );

      const ringMaterial = new THREE.MeshBasicMaterial({
        map: textureLoader.load(textureMap[ringData.Load_Img]),
        side: THREE[ringData.Side],
        transparent: true,
      });

      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.rotation.x = 0.5 * Math.PI;
      mesh.add(ring);
    }

    objects.push({
      mesh: mesh,
      rotationSpeed: item.rotateY,
      revolutionSpeed: item.revolutionSpeed || 0.01,
      baseRevolutionSpeed: item.revolutionSpeed || 0.01,
      angle: item.initialAngle || 0,
      orbit: item.orbit || {
        a: item.Distance_from_star,
        b: item.Distance_from_star,
      },
      details: item.details,
      isHovered: false,
    });
  }
});

// lets add point light source which emits light in all direction and put it in the sun
const pointLight = new THREE.PointLight(0xffffff, 2, 0);
pointLight.decay = 0.1;
scene.add(pointLight);
pointLight.position.set(0, 0, 0);

// When Clicked on Plannet/Star
window.addEventListener("click", () => {
  if (appState.mode !== "solar") return;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(objects.map((o) => o.mesh));

  if (intersects.length > 0) {
    const selected = objects.find((o) => o.mesh === intersects[0].object);

    if (selected) {
      enterFocusMode(selected);
    }
  }
});

// For Focus Mode only
const dirLight = new THREE.DirectionalLight(0xffffff, 2);
dirLight.position.set(-50, 50, 50);
dirLight.visible = false;
scene.add(dirLight);

// Transition of Zoom In and Zoom Out
function enterFocusMode(obj) {
  appState.mode = "focus";
  appState.selected = obj;

  // stop all revolution
  objects.forEach((o) => {
    o.revolutionSpeed = 0;
    if (o !== obj) {
      o.mesh.visible = false;
    }
  });

  // also hide orbit lines
  orbitLines.forEach((line) => (line.visible = false));

  // smooth camera zoom
  const planetPos = obj.mesh.position.clone();

  // distance based on size
  const distance = Math.max(20, obj.mesh.geometry.parameters.radius * 3);

  const targetPos = new THREE.Vector3(
    planetPos.x + distance * 0.8,
    planetPos.y + distance * 0.2,
    planetPos.z + distance * 0.8,
  );

  const focusGroup = new THREE.Group();
  scene.add(focusGroup);
  focusGroup.add(obj.mesh);
  appState.focusGroup = focusGroup;

  gsap.to(camera.position, {
    x: targetPos.x,
    y: targetPos.y,
    z: targetPos.z,
    duration: 1.5,
    onUpdate: () => {
      const lookOffset = new THREE.Vector3(5, 0, 0);
      camera.lookAt(planetPos.clone().add(lookOffset));
    },
  });

  pointLight.visible = false;

  dirLight.visible = true;
  dirLight.target = obj.mesh;
  scene.add(dirLight.target);

  orbit.enabled = false;
  showUI(obj);
}

// For UI
function showUI(obj) {
  const div = document.createElement("div");
  div.className = "planet-ui";
  div.innerHTML = `
    <h1>${obj.details.name}</h1>
    <p>${obj.details.description}</p>
    <ul>
      ${obj.details.key_points.map((p) => `<li>${p}</li>`).join("")}
    </ul>
  `;
  document.body.appendChild(div);
  const btn = document.createElement("button");
  btn.className = "back-btn";
  btn.innerText = "Back";
  document.body.appendChild(btn);

  btn.onclick = exitFocusMode;
}

function exitFocusMode() {
  appState.mode = "solar";
  // restore speeds
  objects.forEach((o) => {
    if (o.baseRevolutionSpeed) {
      o.revolutionSpeed = o.baseRevolutionSpeed;
    }
    o.mesh.visible = true;
  });

  // restore orbit lines toggle
  orbitLines.forEach((line) => {
    line.visible = options.Orbital_Lines;
  });

  // camera reset
  gsap.to(camera.position, {
    x: -90,
    y: 140,
    z: 140,
    duration: 1.5,
    onUpdate: () => {
      camera.lookAt(0, 0, 0);
    },
    onComplete: () => {
      orbit.target.set(0, 0, 0);
      orbit.update();
    },
  });

  if (appState.focusGroup) {
    scene.add(appState.selected.mesh);
    scene.remove(appState.focusGroup);
    appState.focusGroup = null;
  }

  // remove UI
  document.querySelector(".planet-ui")?.remove();

  orbit.enabled = true;
  orbit.update();
  appState.selected = null;

  pointLight.visible = true;
  dirLight.visible = false;

  document.querySelector(".planet-ui")?.remove();
  document.querySelector(".back-btn")?.remove();
}

function animate() {
  objects.forEach((obj) => {
    //When Hover over Plannet/Star then it stops
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(objects.map((o) => o.mesh));

    // reset
    objects.forEach((o) => (o.isHovered = false));

    if (intersects.length > 0) {
      const hovered = objects.find((o) => o.mesh === intersects[0].object);
      if (hovered) {
        hovered.isHovered = true;
      }
    }

    // Self rotation
    if (appState.mode === "solar") {
      obj.mesh.rotateY(obj.rotationSpeed);
    }

    if (obj.orbit) {
      if (appState.mode === "solar") {
        if (!obj.isHovered && obj.orbit) {
          obj.angle += obj.baseRevolutionSpeed * options.OrbitSpeed;
        }
      }

      const a = obj.orbit.a;
      const b = obj.orbit.b;

      const x = a * Math.cos(obj.angle);
      const z = b * Math.sin(obj.angle);

      obj.mesh.position.set(x, 0, z);
    }
  });

  if (appState.mode === "focus" && appState.focusGroup) {
    appState.focusGroup.position.lerp(new THREE.Vector3(-25, 0, 0), 0.05);
    appState.selected.mesh.rotateY(0.01);
  }

  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);

// This is done for responsiveness
window.addEventListener("resize", function () {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth / window.innerHeight);
});
