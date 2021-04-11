import { google, youtube_v3 as youtubeV3 } from 'googleapis';
import Shubot from '.';

const youtubeApi = google.youtube('v3');
export default class youtube {
  private readonly apiKey: string;
  private readonly channelId: string;

  constructor(apiKey: string, channelId: string) {
    this.apiKey = apiKey;
    this.channelId = channelId;
  }

  // date needs to be RFC 3339 formatted e.g. 1970-01-01T00:00:00Z
  public GetVideosAfterDate(date: string): Promise<void | youtubeV3.Schema$SearchListResponse> {
    return youtubeApi.search
      .list({
        part: ['snippet,id'],
        channelId: this.channelId,
        maxResults: 25,
        order: 'date',
        type: ['video'],
        publishedAfter: date,
        key: this.apiKey,
      })
      .then((response) => {
        return response.data;
      })
      .catch(Shubot.log.error);
  }

  public GetLatestVideoDate(): Promise<string | null | undefined | void> {
    return youtubeApi.search
      .list({
        part: ['snippet,id'],
        channelId: this.channelId,
        maxResults: 1,
        order: 'date',
        type: ['video'],
        key: this.apiKey,
      })
      .then((response) => {
        if (response.data.items && response.data.items.length > 0) {
          return response.data.items[0].snippet?.publishedAt;
        } else {
          return new Date().toISOString();
        }
      })
      .catch(Shubot.log.error);
  }
}
