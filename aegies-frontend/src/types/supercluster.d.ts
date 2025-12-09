declare module 'supercluster' {
  export interface Options {
    radius?: number;
    maxZoom?: number;
    minZoom?: number;
    minPoints?: number;
    extent?: number;
    nodeSize?: number;
    log?: boolean;
    generateId?: boolean;
  }

  export interface PointFeature {
    type: 'Feature';
    properties: any;
    geometry: {
      type: 'Point';
      coordinates: [number, number];
    };
  }

  export interface ClusterFeature {
    type: 'Feature';
    properties: {
      cluster: true;
      cluster_id: number;
      point_count: number;
      point_count_abbreviated: string;
    };
    geometry: {
      type: 'Point';
      coordinates: [number, number];
    };
  }

  export type Feature = PointFeature | ClusterFeature;

  export default class Supercluster {
    constructor(options?: Options);
    load(points: PointFeature[]): this;
    getClusters(bbox: [number, number, number, number], zoom: number): Feature[];
    getChildren(clusterId: number): Feature[];
    getLeaves(clusterId: number, limit?: number, offset?: number): PointFeature[];
    getTile(z: number, x: number, y: number): { features: Feature[] } | null;
  }
}

