# Video Danmaku Worker

Lightweight DPlayer-compatible danmaku API backed by Cloudflare D1.

## Endpoints

- `GET /api/danmaku/v3/?id=<video-danmaku-id>&max=1000`
- `POST /api/danmaku/v3/`

The response format matches DPlayer's default backend adapter:

```json
{
  "code": 0,
  "data": [[12.3, 0, 16777215, "guest", "hello"]]
}
```

## Deploy

1. Create a D1 database:

```sh
npx wrangler d1 create 1701701-video-danmaku
```

2. Copy the example config and fill the returned `database_id`:

```sh
cp workers/video-danmaku/wrangler.example.toml workers/video-danmaku/wrangler.toml
```

3. Apply the schema:

```sh
npx wrangler d1 execute 1701701-video-danmaku \
  --file workers/video-danmaku/schema.sql \
  --config workers/video-danmaku/wrangler.toml
```

4. Deploy:

```sh
npx wrangler deploy --config workers/video-danmaku/wrangler.toml
```

5. Enable the frontend:

```sh
VITE_VIDEO_DANMAKU_API_URL=https://1701701.xyz/api/danmaku
```

Production builds default to `/api/danmaku` after the same-origin route is deployed.
Set `VITE_VIDEO_DANMAKU_API_URL=false` to keep danmaku disabled.
