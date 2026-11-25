import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { presentCharacter } from '../characters/presentCharacter';

const loader = new GLTFLoader();
const cache = new Map<string, THREE.Group>();
const animCache = new Map<string, THREE.AnimationClip[]>();

export async function loadGlb(url: string, scale = 1): Promise<THREE.Group | null> {
  if (cache.has(url)) return cloneSkinned(cache.get(url)!) as THREE.Group;
  try {
    const gltf = await loader.loadAsync(url);
    const root = gltf.scene;
    root.scale.setScalar(scale);
    root.traverse((obj) => {
      const mesh = obj as THREE.SkinnedMesh;
      if (!mesh.isMesh) return;
      // Skinned shadow depth shaders fail on these packs and paint the character black.
      const skinned = Boolean(mesh.isSkinnedMesh);
      mesh.castShadow = !skinned;
      mesh.receiveShadow = !skinned;
      if (skinned) mesh.frustumCulled = false;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of materials) {
        const standard = mat as THREE.MeshStandardMaterial;
        if (!standard || !('metalness' in standard)) continue;
        standard.metalness = Math.min(standard.metalness, 0.15);
        standard.roughness = Math.max(standard.roughness, 0.72);
      }
    });
    const characterId = url.match(/\/characters\/([^/]+)\.glb/i)?.[1];
    if (characterId) presentCharacter(root, characterId);
    cache.set(url, root as THREE.Group);
    animCache.set(url, gltf.animations ?? []);
    return cloneSkinned(root) as THREE.Group;
  } catch {
    return null;
  }
}

export function getCachedClips(url: string): THREE.AnimationClip[] {
  return animCache.get(url) ?? [];
}

export function characterUrl(id: string): string {
  return `/assets/models/characters/${id}.glb`;
}

/** Preload common character models; ignore failures. */
export async function preloadCharacters(ids: string[]): Promise<void> {
  await Promise.all(
    ids.map(async (id) => {
      await loadGlb(characterUrl(id), 1);
    }),
  );
}

export function cloneCached(url: string): THREE.Group | null {
  const src = cache.get(url);
  if (!src) return null;
  return cloneSkinned(src) as THREE.Group;
}

export function takeCharacterModel(id: string): { mesh: THREE.Group; clips: THREE.AnimationClip[] } | null {
  const url = characterUrl(id);
  if (!cache.has(url)) return null;
  return {
    mesh: cloneSkinned(cache.get(url)!) as THREE.Group,
    clips: getCachedClips(url),
  };
}
