/**
 * Hello WebXR — cube 1×1×1 m. See: https://developers.google.com/ar/develop/webxr/hello-webxr
 */

import * as THREE from "three";

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
      setMessage("WebXR not supported. Use Chrome on an ARCore-compatible Android device.");
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
    const materials = [
      new THREE.MeshBasicMaterial({ color: 0xff0000 }),
      new THREE.MeshBasicMaterial({ color: 0x0000ff }),
      new THREE.MeshBasicMaterial({ color: 0x00ff00 }),
      new THREE.MeshBasicMaterial({ color: 0xff00ff }),
      new THREE.MeshBasicMaterial({ color: 0x00ffff }),
      new THREE.MeshBasicMaterial({ color: 0xffff00 }),
    ];
    const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), materials);
    cube.position.set(1, 1, 1);
    scene.add(cube);

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
      session = await navigator.xr.requestSession("immersive-ar");
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

    const onXRFrame = (_time: number, frame: XRFrame): void => {
      session.requestAnimationFrame(onXRFrame);

      gl.bindFramebuffer(
        gl.FRAMEBUFFER,
        session.renderState.baseLayer!.framebuffer
      );

      const pose = frame.getViewerPose(referenceSpace);
      if (pose) {
        const view = pose.views[0];
        const baseLayer = session.renderState.baseLayer;
        if (!baseLayer) return;
        const viewport = baseLayer.getViewport(view);
        if (!viewport) return;
        renderer.setSize(viewport.width, viewport.height);

        camera.matrix.fromArray(view.transform.matrix);
        camera.projectionMatrix.fromArray(view.projectionMatrix);
        camera.updateMatrixWorld(true);

        renderer.render(scene, camera);
      }
    };

    session.addEventListener("end", () => {
      setMessage("AR session ended. You can start again.");
      enableButton(btn);
    });

    session.requestAnimationFrame(onXRFrame);
    setMessage("AR active. Move your device to see the 1×1×1 m cube.");
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
