{ pkgs }: {
  deps = [
    pkgs.nodejs_22
    pkgs.nodePackages.npm
    pkgs.nodePackages.typescript
    pkgs.nodePackages.typescript-language-server
    pkgs.bash
    pkgs.git
  ];
}