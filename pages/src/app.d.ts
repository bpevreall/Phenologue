// See https://kit.svelte.dev/docs/types#app
declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      maintenance: boolean;
    }
    interface PageData {
      maintenance?: boolean;
    }
    interface Platform {
      env: {
        MAINTENANCE_MODE?: string;
      };
    }
  }
}

export {};
