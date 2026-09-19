# Third-Party Licenses

This folder contains third-party assets and vendor bundles used by MGIS 3D-Planner.

## Licensing Overview

The project itself is licensed under MPL-2.0. The third-party components currently bundled here use permissive licenses that are generally compatible with MPL-2.0 when the original notices are preserved.

| Component | Location | License | Notes |
| --- | --- | --- | --- |
| Assimp | `public/Thirdparty/Assimp/` | BSD-style license | Keep the bundled `LICENSE` file and attribution notices. |
| Cesium | `public/Thirdparty/Cesium/` | Apache License 2.0 | The Cesium bundle also contains embedded third-party notices inside the build output. Preserve them when redistributing. |
| Cesium Navigation | `public/Thirdparty/cesium-navigation-1.1.8/` | Apache License 2.0 | The package metadata declares `Apache-2.0`. |
| Pannellum | `public/Thirdparty/pannellum-2.5.6/` | MIT License | Keep the upstream license text if you redistribute the files. |

## Compatibility With MPL-2.0

The bundled licenses above are compatible with MPL-2.0 in the current repository layout because they are separate third-party components and their notices are preserved.

Important points:

1. Do not remove or rewrite the upstream license notices inside vendor files.
2. If you copy new third-party assets into the repository, add their license text here before publishing.
3. If you redistribute example media or sample data from upstream packages, check the asset-specific license as well. For example, Pannellum example imagery may have a different license than the viewer code itself.

## Current Assessment

No direct license conflict was identified in the currently bundled third-party code.

This file is a practical project note, not legal advice.