# <samp>setup-minecraft</samp>

[![Test](https://github.com/mcenv/setup-minecraft/actions/workflows/test.yml/badge.svg)](https://github.com/mcenv/setup-minecraft/actions/workflows/test.yml)

This action downloads a specific version of [Minecraft: Java Edition](https://www.minecraft.net/about-minecraft)[^1].

## Inputs

| Name      | Description                              | Default   |
|-----------|------------------------------------------|-----------|
| `version` | Minecraft version to use.                | `release` |
| `install` | Whether to install Minecraft.            | `true`    |
| `cache`   | Whether to cache Minecraft.              | `false`   |
| `retries` | Number of retries to download Minecraft. | `3`       |

## Outputs

| Name      | Description                              |
|-----------|------------------------------------------|
| `version` | Minecraft version used.                  |
| `package` | Package used.                            |

## Example usage

```yml
- uses: actions/checkout@v4
- id: minecraft
  uses: mcenv/setup-minecraft@v3
  with:
    version: "1.20.2"
- uses: actions/setup-java@v3
  with:
    distribution: "microsoft"
    java-version: ${{ fromJson(steps.minecraft.outputs.package).javaVersion.majorVersion }}
- run: |
    echo Running Minecraft ${{ steps.minecraft.outputs.version }}.
    echo "eula=true" > eula.txt
    java -jar $MINECRAFT nogui
```

[^1]: NOT OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG.
