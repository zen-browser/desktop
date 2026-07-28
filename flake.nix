{
  description = "Zen Browser built from source — joegoldin fork (tree-style-tabs)";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-26.05";
    # Firefox 153's configure refuses cbindgen below 0.29.4, and the pin above
    # still carries 0.29.2. Pinned to the nixpkgs commit that first shipped
    # 0.29.4 so only this one tool moves, not the whole toolchain.
    nixpkgs-cbindgen.url = "github:NixOS/nixpkgs/7525d999cd850b9a488817abc89c75dc733acf17";
  };

  outputs =
    { self, nixpkgs, nixpkgs-cbindgen }:
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
          # Overlay rather than an extraNativeBuildInputs entry: buildMozillaMach
          # pulls rust-cbindgen in itself, so it has to be replaced at the pkgs
          # level for configure to see the newer one.
          pkgs = import nixpkgs {
            inherit system;
            overlays = [
              (_final: _prev: {
                inherit (nixpkgs-cbindgen.legacyPackages.${system}) rust-cbindgen;
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
