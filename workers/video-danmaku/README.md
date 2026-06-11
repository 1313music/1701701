# Video Danmaku Worker

Lightweight DPlayer-compatible danmaku API backed by Cloudflare D1.

## Endpoints

- `GET /api/danmaku/v3/?id=<video-danmaku-id>&max=1000`
- `POST /api/danmaku/v3/`
- `GET /api/danmaku/admin/items`
- `DELETE /api/danmaku/admin/items/<id>`

The response format matches DPlayer's default backend adapter:

```json
{
  "code": 0,
  "data": [[12.3, 0, 16777215, "guest", "hello"]]
}
```

New danmaku is visible immediately. The admin endpoints require
`Authorization: Bearer <ADMIN_TOKEN>` and are used by `/myadmin` to review the
list and delete unwanted items.

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

4. Set the admin token secret. Use the same token as `/myadmin`:

```sh
wrangler secret put ADMIN_TOKEN --config workers/video-danmaku/wrangler.toml
```

5. Deploy:

```sh
npx wrangler deploy --config workers/video-danmaku/wrangler.toml
```

6. Enable the frontend:

```sh
VITE_VIDEO_DANMAKU_API_URL=https://1701701.xyz/api/danmaku
```

Production builds default to `/api/danmaku` after the same-origin route is deployed.
Set `VITE_VIDEO_DANMAKU_API_URL=false` to keep danmaku disabled.
The `/myadmin` danmaku panel defaults to `/api/danmaku/admin` on production.
