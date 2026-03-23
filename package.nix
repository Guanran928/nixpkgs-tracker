{
  lib,
  fetchPnpmDeps,
  nodejs,
  pnpm,
  pnpmConfigHook,
  stdenv,
}:
stdenv.mkDerivation (finalAttrs: {
  pname = "nixpkgs-tracker";
  version = "dev";

  src = lib.cleanSource ./.;

  nativeBuildInputs = [
    nodejs
    pnpm
    pnpmConfigHook
  ];

  pnpmDeps = fetchPnpmDeps {
    inherit (finalAttrs) pname version src;
    fetcherVersion = 2;
    hash = "sha256-ar9h+FtmxDmaAS9GmN2PUjmV7tkV/VFhoKDg27Y27xk=";
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
