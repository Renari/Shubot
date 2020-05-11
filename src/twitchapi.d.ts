export declare namespace TwitchAPI {
  export interface Broadcaster {
    id: string;
    name: string;
    display_name: string;
    channel_url: string;
    logo: string;
  }

  export interface Curator {
    id: string;
    name: string;
    display_name: string;
    channel_url: string;
    logo: string;
  }

  export interface Vod {
    id: string;
    url: string;
    offset: number;
    preview_image_url: string;
  }

  export interface Thumbnails {
    medium: string;
    small: string;
    tiny: string;
  }

  export interface Clip {
    slug: string;
    tracking_id: string;
    url: string;
    embed_url: string;
    embed_html: string;
    broadcaster: Broadcaster;
    curator: Curator;
    vod: Vod;
    broadcast_id: string;
    game: string;
    language: string;
    title: string;
    views: number;
    duration: number;
    created_at: Date;
    thumbnails: Thumbnails;
  }
}
