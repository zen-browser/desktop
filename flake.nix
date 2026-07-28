{
  description = "Zen Browser built from source — joegoldin fork (tree-style-tabs)";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-26.05";
    # Firefox 153 outruns nixos-26.05 on two build inputs: configure refuses
    # cbindgen below 0.29.4 (the pin has 0.29.2) and nss below 3.125 (the pin's
    # nss_latest is 3.124). Take just those two from a newer nixpkgs rather than
    # moving the whole toolchain. Both can go once the main pin catches up.
    nixpkgs-newer.url = "github:NixOS/nixpkgs/7525d999cd850b9a488817abc89c75dc733acf17";
  };

  outputs =
    { self, nixpkgs, nixpkgs-newer }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "aarch64-darwin"
        "x86_64-darwin"
      ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in
    {
      packages = forAllSystems (
        system:
        let
          # An overlay rather than extraNativeBuildInputs entries: buildMozillaMach
          # reaches for rust-cbindgen and nss_latest itself, so they have to be
          # replaced at the pkgs level for configure to see the newer ones.
          pkgs = import nixpkgs {
            inherit system;
            overlays = [
              (_final: _prev: {
                inherit (nixpkgs-newer.legacyPackages.${system})
                  rust-cbindgen
                  nss_latest
                  ;
              })
            ];
          };
          # `self` is the fork tree itself — the thing the build patches into the
          # Firefox source — so building this flake builds whatever commit is
          # referenced (locally: the checkout; from dotfiles: the pinned rev).
          zen-browser-unwrapped = pkgs.callPackage ./nix/package.nix {
            zen-src-tree = self;
          };
        in
        {
          inherit zen-browser-unwrapped;
          default = zen-browser-unwrapped;
        }
      );

      formatter = forAllSystems (system: nixpkgs.legacyPackages.${system}.nixfmt-rfc-style);
    };
}
