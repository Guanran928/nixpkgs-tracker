{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    inputs:
    inputs.flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = inputs.nixpkgs.legacyPackages.${system};
      in
      {
        packages = rec {
          default = nixpkgs-tracker;
          nixpkgs-tracker = pkgs.callPackage ./package.nix { };
        };

        devShells.default = pkgs.mkShellNoCC {
          nativeBuildInputs = with pkgs; [
            nodePackages.prettier
            nodejs
            pnpm
            tailwindcss-language-server
            typescript-language-server
          ];
        };
      }
    );
}
