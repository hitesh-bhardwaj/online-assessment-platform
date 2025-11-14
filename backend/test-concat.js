require('dotenv').config();
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

async function testConcat() {
  const keys = [
    'proctoring/6917029e27cc8e2cc50ecb5a/webcam-1763115687920-e5c25cf6-8d15-453a-b07f-6973e60ed849.webm',
    'proctoring/6917029e27cc8e2cc50ecb5a/webcam-1763115695952-2fb34ab8-d371-4f59-bd42-330f9ccb9ec5.webm',
  ];

  console.log('Downloading chunks...\n');
  for (let i = 0; i < keys.length; i++) {
    const response = await client.send(new GetObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: keys[i],
    }));

    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    await fs.writeFile(`/tmp/chunk${i}.webm`, buffer);
    console.log(`Downloaded chunk${i}.webm (${(buffer.length / 1024).toFixed(2)} KB)`);
  }

  console.log('\nAnalyzing chunk codecs with ffprobe...\n');

  for (let i = 0; i < keys.length; i++) {
    console.log(`\n=== Chunk ${i} ===`);
    const { stdout } = await execAsync(`ffprobe -v error -show_entries stream=codec_name,codec_type,width,height -of json /tmp/chunk${i}.webm`);
    console.log(stdout);

    const { stdout: duration } = await execAsync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 /tmp/chunk${i}.webm`);
    console.log(`Duration: ${parseFloat(duration).toFixed(2)}s`);
  }

  console.log('\n\nTesting concat demuxer...\n');
  await fs.writeFile('/tmp/filelist.txt', "file '/tmp/chunk0.webm'\nfile '/tmp/chunk1.webm'");

  try {
    const { stderr } = await execAsync(`ffmpeg -f concat -safe 0 -i /tmp/filelist.txt -c copy /tmp/merged-test.webm -y`);
    console.log('Concat stderr:', stderr);

    const { stdout: mergedDuration } = await execAsync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 /tmp/merged-test.webm`);
    console.log(`\n✅ Merged duration: ${parseFloat(mergedDuration).toFixed(2)}s`);

    const stats = await fs.stat('/tmp/merged-test.webm');
    console.log(`✅ Merged size: ${(stats.size / 1024).toFixed(2)} KB`);
  } catch (error) {
    console.error('❌ Concat failed:', error.message);
  }
}

testConcat().catch(console.error);
