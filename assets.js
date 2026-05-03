import * as THREE from "three";

export class AssetManager {
  constructor() {
    this.loadingManager = new THREE.LoadingManager();
    this.gltfLoaderPromise = null;
    this.cache = new Map();
  }

  async getGLTFLoader() {
    if (!this.gltfLoaderPromise) {
      this.gltfLoaderPromise = import("three/addons/loaders/GLTFLoader.js")
        .then(({ GLTFLoader }) => new GLTFLoader(this.loadingManager));
    }

    return this.gltfLoaderPromise;
  }

  loadModel(url) {
    if (!url || typeof url !== "string") {
      return Promise.reject(new Error("AssetManager.loadModel requires a model URL string."));
    }

    if (this.cache.has(url)) {
      return this.cache.get(url);
    }

    const modelPromise = this.getGLTFLoader()
      .then((loader) => loader.loadAsync(url))
      .then((gltf) => {
        gltf.scene.traverse((node) => {
          if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
          }
        });

        return gltf;
      })
      .catch((error) => {
        this.cache.delete(url);
        throw new Error(`Failed to load GLTF model "${url}": ${error.message}`);
      });

    this.cache.set(url, modelPromise);
    return modelPromise;
  }

  clearCache() {
    this.cache.clear();
  }
}

export const assetManager = new AssetManager();

export function loadModel(url) {
  return assetManager.loadModel(url);
}
