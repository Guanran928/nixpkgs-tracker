{
  lib,
  nodejs,
  pnpm,
  stdenv,
}:
stdenv.mkDerivation (finalAttrs: {
  pname = "nixpkgs-tracker";
  version = "dev";

  src = lib.cleanSource ./.;

  nativeBuildInputs = [
    nodejs
    pnpm.configHook
  ];

  pnpmDeps = pnpm.fetchDeps {
    inherit (finalAttrs) pname version src;
    fetcherVersion = 2;
    hash = "sha256-vfC0g7V+04vBAOqMQhqHsp9nVRDYEw2VcCYfb4GTS4U=";
  };

  buildPhase = ''
    runHook preBuild

    pnpm build

    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall

    cp -r ./dist $out

    runHook postInstall
  '';

  meta = {
    homepage = "https://github.com/Guanran928/nixpkgs-tracker";
    license = lib.licenses.mit;
  };
})
