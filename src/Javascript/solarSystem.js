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

// GUI
const gui = new dat.GUI();
const options = {
  Orbital_Lines: true,
  OrbitSpeed: 1,
};

gui.add(options, "Orbital_Lines").onChange((value) => {
  orbitLines.forEach(line => {
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
      angle: item.initialAngle || 0,
      orbit: item.orbit || {
        a: item.Distance_from_star,
        b: item.Distance_from_star,
      },
    });
  }
});

// lets add point light source which emits light in all direction and put it in the sun
const pointLight = new THREE.PointLight(0xffffff, 2, 0);
pointLight.decay = 0.1;
scene.add(pointLight);
pointLight.position.set(0, 0, 0);

function animate() {
  objects.forEach((obj) => {
    // Self rotation
    obj.mesh.rotateY(obj.rotationSpeed);

    if (obj.orbit) {
      obj.angle += obj.revolutionSpeed * options.OrbitSpeed;

      const a = obj.orbit.a;
      const b = obj.orbit.b;

      const x = a * Math.cos(obj.angle);
      const z = b * Math.sin(obj.angle);

      obj.mesh.position.set(x, 0, z);
    }
  });

  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);

// This is done for responsiveness
window.addEventListener("resize", function () {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth / window.innerHeight);
});
