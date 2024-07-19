
export ZEN_RELEASE=1
xvfb-run -s "-screen 0 1920x1080x24 -nolisten local" pnpm build
