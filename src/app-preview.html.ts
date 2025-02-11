import { html } from "hono/html";
import { Manifest } from "./manifest.type";
export function generateDeepLinkPreview(manifest: Manifest, _url: string) {
  const iconUrl = manifest.extra.expoClient.iconUrl;
  const appName = manifest.extra.expoClient.name;
  const url = _url.replace(/https?:\/\//, "exp://");

  return html`
    <!DOCTYPE html>
    <html class="dark">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${appName} - Preview on Tetri</title>
        <style>
          :root {
            --background: 224 71% 2%;
            --foreground: 213 31% 91%;
            --muted: 223 47% 8%;
            --muted-foreground: 215.4 16.3% 56.9%;
            --accent: 216 34% 12%;
            --accent-foreground: 210 40% 98%;
            --primary: 210 40% 98%;
            --primary-foreground: 222.2 47.4% 1.2%;
          }

          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            height: 100dvh;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
              Helvetica, Arial, sans-serif;
            background-color: hsl(var(--background));
            color: hsl(var(--foreground));
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 48px 24px;
          }

          .logo-container {
            display: flex;
            align-items: center;
            gap: 8px;
            position: absolute;
            top: 18px;
            left: 20px;
          }

          .logo {
            width: 28px;
            height: 28px;
            fill: #fcd34d;
          }

          .logo-text {
            font-size: 20px;
            font-weight: 600;
            color: hsl(var(--foreground));
          }

          .app-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 24px;
            max-width: 400px;
            width: 100%;
            justify-content: center;
            height: 100%;
          }

          .app-icon {
            width: 96px;
            height: 96px;
            border-radius: 20px;
            background: hsl(var(--accent));
          }

          .app-name {
            font-size: 24px;
            font-weight: 600;
            color: hsl(var(--foreground));
            text-align: center;
          }

          .button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            height: 44px;
            padding: 0 20px;
            font-size: 12px;
            font-weight: 500;
            border-radius: 8px;
            border: none;
            cursor: pointer;
            text-decoration: none;
            transition: all 0.2s;
            width: 100%;
          }

          .button.primary {
            background: hsl(var(--primary));
            color: hsl(var(--primary-foreground));
          }

          .button.primary:hover {
            opacity: 0.9;
          }

          .button.secondary {
            background: hsl(var(--accent));
            color: hsl(var(--accent-foreground));
          }

          .button.secondary:hover {
            background: hsl(var(--accent) / 0.8);
          }

          .button-group {
            display: flex;
            flex-direction: row;
            gap: 8px;
            width: 100%;
          }

          .description {
            font-size: 15px;
            color: hsl(var(--muted-foreground));
            text-align: center;
            margin-top: 40px;
          }
        </style>
        <meta http-equiv="refresh" content="0;url=${url}" />
      </head>
      <body>
        <div class="logo-container">
          <svg class="logo" viewBox="0 0 29 29">
            <path
              d="M 14.5 0 L 15.322 4.987 C 16.056 9.448 19.552 12.944 24.013 13.678 L 29 14.5 L 24.013 15.322 C 19.552 16.056 16.056 19.552 15.322 24.013 L 14.5 29 L 13.678 24.013 C 12.944 19.552 9.448 16.056 4.987 15.322 L 0 14.5 L 4.987 13.678 C 9.448 12.944 12.944 9.448 13.678 4.987 Z"
            ></path>
          </svg>
          <span class="logo-text">Tetri</span>
        </div>

        <div class="app-container">
          <img src="${iconUrl}" class="app-icon" alt="${appName} icon" />
          <h1 class="app-name">${appName}</h1>

          <a href="${url}" class="button primary" style="font-size: 15px">
            Open in Expo Go
          </a>

          <p class="description">
            If the app doesn't open automatically, you'll need Expo Go
            installed:
          </p>

          <div class="button-group">
            <a
              href="https://apps.apple.com/app/apple-store/id982107779"
              class="button secondary"
              target="_blank"
              rel="noopener noreferrer"
            >
              Expo Go for iOS
            </a>
            <a
              href="https://play.google.com/store/apps/details?id=host.exp.exponent"
              class="button secondary"
              target="_blank"
              rel="noopener noreferrer"
            >
              Expo Go for Android
            </a>
          </div>
        </div>
      </body>
    </html>
  `;
}
