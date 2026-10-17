const fs = require('fs');

const API_KEY = process.env.YOUTUBE_API_KEY;
const UPLOADS_PLAYLIST_ID = 'UUAAV0od4A-X7khwScUqflrQ';

if (!API_KEY) {
  console.error('エラー: 環境変数 YOUTUBE_API_KEY が見つかりません。');
  process.exit(1);
}

async function fetchAllVideos() {
  console.log(`[1/3] プレイリスト (${UPLOADS_PLAYLIST_ID}) から動画一覧を取得中...`);
  let videoIds = [];
  let nextPageToken = '';

  try {
    do {
      const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${UPLOADS_PLAYLIST_ID}&maxResults=50&pageToken=${nextPageToken}&key=${API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.error) {
        console.error('APIエラー:', data.error.message);
        process.exit(1);
      }

      if (data.items) {
        data.items.forEach(item => {
          if (item.contentDetails && item.contentDetails.videoId) {
            videoIds.push(item.contentDetails.videoId);
          }
        });
      }
      nextPageToken = data.nextPageToken || '';
    } while (nextPageToken);

    console.log(`検出動画数: ${videoIds.length} 本`);

    console.log('[2/3] 動画の詳細データを取得中...');
    let allVideos = [];
    for (let i = 0; i < videoIds.length; i += 50) {
      const chunk = videoIds.slice(i, i + 50).join(',');
      const vUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${chunk}&key=${API_KEY}`;
      const vRes = await fetch(vUrl);
      const vData = await vRes.json();

      if (vData.items) {
        vData.items.forEach(v => {
          allVideos.push({
            id: v.id,
            title: v.snippet.title,
            views: parseInt(v.statistics.viewCount || '0', 10),
            publishedAt: v.snippet.publishedAt ? v.snippet.publishedAt.split('T')[0] : ''
          });
        });
      }
    }

    console.log('[3/3] レアリティを算出中...');
    allVideos.sort((a, b) => b.views - a.views);

    const total = allVideos.length;
    const ssrLimit = Math.max(1, Math.ceil(total * 0.01));
    const srLimit = Math.max(ssrLimit + 1, Math.ceil(total * 0.10));
    const rLimit = Math.ceil(total * 0.40);

    const formattedList = allVideos.map((video, idx) => {
      let rarity = 'N';
      if (idx < ssrLimit) rarity = 'SSR';
      else if (idx < srLimit) rarity = 'SR';
      else if (idx < rLimit) rarity = 'R';

      return {
        id: video.id,
        title: video.title,
        views: video.views,
        rarity: rarity,
        publishedAt: video.publishedAt
      };
    });

    fs.writeFileSync('videos.json', JSON.stringify(formattedList, null, 2), 'utf-8');
    console.log(`✅ videos.json の更新完了 (全 ${total} 本)`);
  } catch (err) {
    console.error('処理失敗:', err);
    process.exit(1);
  }
}

fetchAllVideos();
