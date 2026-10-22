import * as THREE from 'three';
import { disposeSceneAssets } from './render-disposal';
import { createSceneLighting } from './scene-lighting';
import { oakMaps } from './wood-textures';
import { fabricTexture } from './fabric';
import { DRAPE } from './garment-types';
import { createStageFloor } from './stage-floor';
import { createDecorTextureLoader } from './decor-textures';
/** Three.js owns its renderer, lights, materials and reusable textures here. */
export function createViewportResources(cv) {
    const R = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
    R.outputEncoding = THREE.sRGBEncoding;
    R.toneMapping = THREE.ACESFilmicToneMapping;
    // Use the same exposure as the clothing reference.
    R.toneMappingExposure = DRAPE.exposure;
    R.shadowMap.enabled = true;
    R.shadowMap.type = THREE.PCFSoftShadowMap;
    R.setPixelRatio(Math.min(devicePixelRatio, 2));
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(35, 1, 5, 50000);
    // A photographed-interior light: soft environment, a warm sun with real shadows, a quiet sky fill.
    const lighting = createSceneLighting(R, scene);
    // Without a room, wardrobes stand on oak boards that fade into the background, like a showroom photo.
    const stage = createStageFloor(scene);
    const contactCanvas = cv.ownerDocument.createElement('canvas');
    contactCanvas.width = contactCanvas.height = 128;
    const contactCtx = contactCanvas.getContext('2d'), contactGradient = contactCtx.createRadialGradient(64, 64, 8, 64, 64, 64);
    contactGradient.addColorStop(0, 'rgba(55,42,26,.26)');
    contactGradient.addColorStop(.5, 'rgba(55,42,26,.12)');
    contactGradient.addColorStop(1, 'rgba(55,42,26,0)');
    contactCtx.fillStyle = contactGradient;
    contactCtx.fillRect(0, 0, 128, 128);
    const contact = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(contactCanvas), transparent: true, depthWrite: false }));
    contact.rotation.x = -Math.PI / 2;
    contact.position.y = .12;
    scene.add(contact);
    const aoCanvas = cv.ownerDocument.createElement('canvas');
    aoCanvas.width = aoCanvas.height = 128;
    const aoCtx = aoCanvas.getContext('2d');
    const aoH = aoCtx.createLinearGradient(0, 0, 128, 0);
    aoH.addColorStop(0, 'rgba(40,28,12,.30)');
    aoH.addColorStop(.13, 'rgba(40,28,12,0)');
    aoH.addColorStop(.87, 'rgba(40,28,12,0)');
    aoH.addColorStop(1, 'rgba(40,28,12,.30)');
    aoCtx.fillStyle = aoH;
    aoCtx.fillRect(0, 0, 128, 128);
    const aoV = aoCtx.createLinearGradient(0, 0, 0, 128);
    aoV.addColorStop(0, 'rgba(40,28,12,.3)');
    aoV.addColorStop(.17, 'rgba(40,28,12,0)');
    aoV.addColorStop(.9, 'rgba(40,28,12,0)');
    aoV.addColorStop(1, 'rgba(40,28,12,.2)');
    aoCtx.fillStyle = aoV;
    aoCtx.fillRect(0, 0, 128, 128);
    const aoTexture = new THREE.CanvasTexture(aoCanvas);
    const HM = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    // Photographed oak veneer, one set of maps shared by every board of every wardrobe in this editor.
    const veneer = oakMaps(cv.ownerDocument, 'veneer', Math.min(8, R.capabilities.getMaxAnisotropy()));
    const decorTexture = createDecorTextureLoader(cv.ownerDocument);
    const M = (c, o) => {
        const m = new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .82 }, o));
        m.color.convertSRGBToLinear();
        return m;
    };
    // Lacquered veneer: the finish colour tints the photographed grain; the pores show in the normal map and
    // the satin coat in the roughness map. Boards get true-scale UVs and eased edges (board-geometry.ts).
    const wood = c => {
        const m = M(c, { ...veneer, normalScale: new THREE.Vector2(.3, .3), roughness: 1, envMapIntensity: .45 });
        m.userData.board = true;
        return m;
    };
    // Matte woven cloth for the clothes on the rails.
    const cloth = fabricTexture(cv.ownerDocument);
    cloth.repeat.set(1 / 30, 1 / 45);
    const fabric = c => M(c, { map: cloth, roughness: .95, envMapIntensity: .25 });
    const softArea = (w, h, d, opacity) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: 0xfff3d9, transparent: true, opacity, depthWrite: false }));
    const shade = (c, f) => '#' + new THREE.Color(c).multiplyScalar(f).getHexString();
    function dispose() {
        lighting.dispose();
        stage.dispose();
        disposeSceneAssets(scene, [veneer.map, veneer.roughnessMap, veneer.normalMap, cloth, aoTexture], [HM]);
        scene.clear();
        R.dispose();
        R.forceContextLoss();
    }
    return { cv, R, scene, cam, contact, aoTexture, HM, M, wood, decorTexture, fabric, softArea, shade, lighting, ground: stage.mesh, stage, dispose };
}
