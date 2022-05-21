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
    id: string;
    url: string;
    embed_url: string;
    broadcaster_id: string;
    broadcaster_name: string;
    creator_id: string;
    creator_name: string;
    video_id: string;
    game_id: string;
    language: string;
    title: string;
    view_count: number;
    created_at: Date;
    thumbnail_url: string;
    duration: number;
  }
}
