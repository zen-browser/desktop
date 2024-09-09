# Checkout this documentation to build new tab assets

- [New Tab Documentation](https://firefox-source-docs.mozilla.org/browser/components/newtab/docs/index.html)
- You also need `meow@9.0.0` (that's the one I tested) because other versions might not work.
- To bundle the new tab, execute the following:

```
./mach npm run bundle --prefix=browser/components/newtab
```
