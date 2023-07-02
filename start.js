const fs = require('fs');
const readline = require('readline');
const fetch = require('node-fetch');

const inputFile = 'input.txt';
const mediaArray = [];

// Console text color codes
const colors = {
  reset: '\x1b[0m',
  error: '\x1b[31m', // Red
  info: '\x1b[33m', // Orange
  success: '\x1b[32m', // Green
};

// Curried log wrapper functions
const log = {
  error: (message) =>
    console.log(`${colors.error}[X] ${message}${colors.reset}`),
  info: (message) => console.log(`${colors.info}[*] ${message}${colors.reset}`),
  success: (message) =>
    console.log(`${colors.success}[*] ${message}${colors.reset}`),
};

async function start() {
  const videoUrls = [];

  if (!fs.existsSync(inputFile)) {
    log.error('Error: File not found');
    return;
  }

  const readInterface = readline.createInterface({
    input: fs.createReadStream(inputFile),
    crlfDelay: Infinity,
  });

  // Read URLs from the file
  for await (const line of readInterface) {
    videoUrls.push(line);
    log.info(`Found URL: ${line}`);
  }

  // Extract video ID from the URL
  const extractVideoId = (url) => {
    const isVideoUrl = url.includes('/video/');
    if (!isVideoUrl) {
      log.error('Error: URL not found');
      return null;
    }
    const videoId = url.substring(url.indexOf('/video/') + 7, url.length);
    return videoId.length > 19
      ? videoId.substring(0, videoId.indexOf('?'))
      : videoId;
  };

  // Download media files from the array
  const downloadMedia = async (array) => {
    const folder = 'downloads/';
    for (const item of array) {
      const fileName = `${item.id}.mp4`;
      const downloadPromise = fetch(item.url);
      const fileStream = fs.createWriteStream(folder + fileName);

      log.info(`Downloading file: ${fileName}`);

      await new Promise((resolve, reject) => {
        downloadPromise
          .then((response) => {
            response.body.pipe(fileStream);
            fileStream.on('finish', () => {
              fileStream.close();
              log.success(`File downloaded: ${fileName}`);
              resolve();
            });
            fileStream.on('error', (err) => reject(err));
          })
          .catch((err) => reject(err));
      });
    }
  };

  // Get video data from the TikTok API
  const getVideoData = async (url) => {
    log.info(`Fetching data for URL: ${url}`);
    const videoId = extractVideoId(url);
    if (!videoId) {
      return null;
    }

    const apiUrl = `https://api16-normal-c-useast1a.tiktokv.com/aweme/v1/feed/?aweme_id=${videoId}`;
    const request = await fetch(apiUrl, {
      method: 'GET',
    });
    const responseBody = await request.text();
    try {
      var response = JSON.parse(responseBody);
    } catch (err) {
      log.error('Error:', err);
      log.error('Response body:', responseBody);
      return null;
    }
    const mediaUrl = response.aweme_list[0].video.play_addr.url_list[0];
    const videoData = {
      url: mediaUrl,
      id: videoId,
    };

    return videoData;
  };

  // Process each URL and add valid media data to the array
  for (const url of videoUrls) {
    const mediaData = await getVideoData(url);
    if (mediaData) {
      mediaArray.push(mediaData);
    }
  }

  // Download media files from the array
  await downloadMedia(mediaArray);
}

start();
