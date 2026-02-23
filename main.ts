/**
 * WebXR Hit Test — Lab 2. Surface detection and model placement.
 * See: https://developers.google.com/ar/develop/webxr/hello-webxr
 */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

function setMessage(text: string): void {
  const el = document.getElementById("message");
  if (el) el.textContent = text;
}

function enableButton(btn: HTMLButtonElement | null): void {
  if (btn) btn.disabled = false;
}

async function activateXR(): Promise<void> {
  const btn = document.getElementById("start-ar") as HTMLButtonElement;
  if (btn) {
    btn.disabled = true;
    setMessage("Starting AR… Allow camera access if the browser asks.");
  }

  try {
    if (!navigator.xr) {
      setMessage(
        "WebXR not supported. Use Chrome on an ARCore-compatible Android device.",
      );
      enableButton(btn);
      return;
    }

    const canvas = document.createElement("canvas");
    document.body.appendChild(canvas);

    const gl = canvas.getContext("webgl2", { xrCompatible: true });
    if (!gl) {
      setMessage("Could not get WebGL context.");
      enableButton(btn);
      return;
    }

    const scene = new THREE.Scene();

    // Lighting for better model visibility
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(10, 15, 10);
    scene.add(directionalLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      preserveDrawingBuffer: true,
      canvas,
      context: gl,
    });
    renderer.autoClear = false;

    const camera = new THREE.PerspectiveCamera();
    camera.matrixAutoUpdate = false;

    let session: XRSession;
    try {
      session = await navigator.xr.requestSession("immersive-ar", {
        requiredFeatures: ["local", "hit-test"],
      });
      console.log("[WebXR] AR session started successfully");
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      setMessage("AR session failed: " + err + ". Allow camera and reload.");
      enableButton(btn);
      return;
    }

    session.updateRenderState({
      baseLayer: new XRWebGLLayer(session, gl),
    });

    const referenceSpace = await session.requestReferenceSpace("local");

    // Create viewer space for hit testing
    const viewerSpace = await session.requestReferenceSpace("viewer");

    // Create hit test source
    let hitTestSource: XRHitTestSource | undefined = undefined;
    if (session.requestHitTestSource) {
      hitTestSource = await session.requestHitTestSource({
        space: viewerSpace,
      });
      console.log("[WebXR] Hit test source created");
    }

    // Load reticle (targeting marker)
    const gltfLoader = new GLTFLoader();
    let reticle: THREE.Object3D | null = null;
    gltfLoader.load(
      "https://immersive-web.github.io/webxr-samples/media/gltf/reticle/reticle.gltf",
      (gltf) => {
        reticle = gltf.scene;
        reticle.visible = false;
        scene.add(reticle);
        console.log("[WebXR] Reticle loaded successfully");
      },
    );

    // Load custom model (ammo_crate)
    let model: THREE.Object3D | null = null;
    gltfLoader.load("/Handmade/ammo_crate.glb", (gltf) => {
      model = gltf.scene;
      model.scale.set(0.2, 0.2, 0.2);
      console.log("[WebXR] Model 'ammo_crate.glb' loaded successfully");
    });

    // Handle select event (tap on screen)
    let objectsPlaced = 0;
    session.addEventListener("select", () => {
      if (model && reticle && reticle.visible) {
        const clone = model.clone();
        clone.position.copy(reticle.position);
        scene.add(clone);
        objectsPlaced++;
        console.log(
          `[WebXR] Object placed at position (${reticle.position.x.toFixed(2)}, ${reticle.position.y.toFixed(2)}, ${reticle.position.z.toFixed(2)}). Total objects: ${objectsPlaced}`,
        );
      }
    });

    const onXRFrame = (_time: number, frame: XRFrame): void => {
      session.requestAnimationFrame(onXRFrame);

      gl.bindFramebuffer(
        gl.FRAMEBUFFER,
        session.renderState.baseLayer!.framebuffer,
      );

      const pose = frame.getViewerPose(referenceSpace);
      if (pose) {
        const view = pose.views[0];
        const baseLayer = session.renderState.baseLayer;
        if (!baseLayer) return;
        const viewport = baseLayer.getViewport(view);
        if (!viewport) return;
        renderer.setSize(viewport.width, viewport.height);

        // Process hit test results
        if (hitTestSource) {
          const hitTestResults = frame.getHitTestResults(hitTestSource);
          if (hitTestResults.length > 0 && reticle) {
            const hitPose = hitTestResults[0].getPose(referenceSpace);
            if (hitPose) {
              if (!reticle.visible) {
                console.log(
                  "[WebXR] Surface detected! Reticle is now visible.",
                );
              }
              reticle.visible = true;
              reticle.position.set(
                hitPose.transform.position.x,
                hitPose.transform.position.y,
                hitPose.transform.position.z,
              );
              reticle.updateMatrixWorld(true);
            }
          } else if (reticle) {
            if (reticle.visible) {
              console.log("[WebXR] Surface lost. Reticle hidden.");
            }
            reticle.visible = false;
          }
        }

        camera.matrix.fromArray(view.transform.matrix);
        camera.projectionMatrix.fromArray(view.projectionMatrix);
        camera.updateMatrixWorld(true);

        renderer.render(scene, camera);
      }
    };

    session.addEventListener("end", () => {
      console.log("[WebXR] AR session ended");
      setMessage("AR session ended. You can start again.");
      enableButton(btn);
    });

    session.requestAnimationFrame(onXRFrame);
    setMessage(
      "AR active. Point at a surface and tap to place the ammo crate.",
    );
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    setMessage("Error: " + err);
    enableButton(btn);
  }
}

function init(): void {
  const btn = document.getElementById("start-ar");
  if (!btn) return;
  btn.addEventListener("click", () => activateXR());
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
