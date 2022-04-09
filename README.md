# setup-minecraft

This action downloads and caches a specific version of Minecraft.

## Inputs

### `version`

Minecraft version to use. Default `release`.

## Outputs

### `version`

Minecraft version used.

## Example usage

```yml
- uses: actions/checkout@v3
- id: minecraft
  uses: mcenv/setup-minecraft@v2
  with:
    version: "1.18.2"
- uses: actions/setup-java@v3
  with:
    distribution: "temurin"
    java-version: "17"
- run: |
    echo Running Minecraft ${{ steps.minecraft.outputs.version }}.
    echo "eula=true" > eula.txt
    minecraft --nogui -Xmx2G
```
