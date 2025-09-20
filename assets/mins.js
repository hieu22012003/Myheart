import * as THREE from "three";

/**
 * Tạo vật liệu PointsMaterial tùy chỉnh với nhiều option nâng cao
 * @param {Object} options
 * @param {THREE.Texture} options.map - Texture cho điểm
 * @param {Number} options.color - Màu sắc (hex), mặc định trắng
 * @param {Boolean} options.transparent - Cho phép trong suốt
 * @param {Boolean} options.vertexColors - Có dùng màu vertex không
 * @param {Boolean} options.sizeAttenuation - Có thu nhỏ điểm khi xa camera không
 * @param {Boolean} options.alphaSupport - Có hỗ trợ alpha per vertex không (cần attribute alpha)
 * @param {Number} options.clipBandWidth - Độ rộng vùng clip theo trục X
 * @param {Number} options.vClipSlope - Độ dốc clipping theo Z
 * @param {Number} options.clipFrontZ - Vị trí Z bắt đầu clipping
 * @param {Number} options.blending - Kiểu blending (mặc định NormalBlending)
 * @param {Number} options.opacity - Độ mờ tổng thể
 * @param {Boolean} options.depthWrite - Có ghi depth buffer không
 * @returns {THREE.PointsMaterial}
 */
export function makeMat({
  map = null,
  color = 0xffffff,
  transparent = true,
  vertexColors = true,
  sizeAttenuation = true,
  alphaSupport = false,
  clipBandWidth = 0,
  vClipSlope = 0,
  clipFrontZ = 0.1,
  blending = THREE.NormalBlending,
  opacity = 1,
  depthWrite = true,
} = {}) {
  // Tạo material với các option cơ bản
  const material = new THREE.PointsMaterial({
    map,
    color,
    transparent,
    vertexColors,
    sizeAttenuation,
    blending,
    opacity,
    depthWrite,
  });

  // Tuỳ biến shader trước khi biên dịch
  material.onBeforeCompile = (shader) => {
    // Thêm attribute và varying vào vertex shader nếu cần
    shader.vertexShader = shader.vertexShader.replace(
      "uniform float size;",
      `attribute float size;${
        alphaSupport ? "\nattribute float alpha;\nvarying float vAlpha;" : ""
      }${clipBandWidth > 0 || vClipSlope > 0 ? "\nvarying vec3 vViewPos;" : ""}`
    );

    let vertexInjectCode = "";

    // Nếu có clipping theo view position thì truyền biến
    if (clipBandWidth > 0 || vClipSlope > 0) {
      vertexInjectCode += "  vViewPos = mvPosition.xyz;\n";
    }

    // Nếu alpha per vertex thì truyền alpha
    if (alphaSupport) {
      vertexInjectCode += "  vAlpha = alpha;\n";
    }

    // Chèn đoạn code vừa tạo vào shader
    if (vertexInjectCode) {
      shader.vertexShader = shader.vertexShader.replace(
        "#include <project_vertex>",
        `#include <project_vertex>\n${vertexInjectCode}`
      );
    }

    // Tuỳ biến fragment shader nếu có alpha per vertex
    if (alphaSupport) {
      shader.fragmentShader = shader.fragmentShader
        .replace("void main() {", "varying float vAlpha;\nvoid main(){")
        .replace(
          "gl_FragColor = vec4( outgoingLight, diffuseColor.a );",
          "gl_FragColor = vec4( outgoingLight, diffuseColor.a * vAlpha );"
        );
    }

    // Nếu có clipping logic thì thêm đoạn discard phù hợp
    if (clipBandWidth > 0 || vClipSlope > 0) {
      shader.fragmentShader = shader.fragmentShader.replace(
        "void main(){",
        "varying vec3 vViewPos;\nvoid main(){"
      );

      let clipCode = "";

      if (clipBandWidth > 0) {
        clipCode += `if (abs(vViewPos.x) < ${clipBandWidth.toFixed(
          3
        )} && vViewPos.z < -${clipFrontZ.toFixed(3)}) discard;`;
      }

      if (vClipSlope > 0) {
        clipCode += `\n  if (vViewPos.z < -${clipFrontZ.toFixed(
          3
        )} && abs(vViewPos.x) < ${vClipSlope.toFixed(
          3
        )} * (-vViewPos.z)) discard;`;
      }

      const originalFragColor = alphaSupport
        ? "gl_FragColor = vec4( outgoingLight, diffuseColor.a * vAlpha );"
        : "gl_FragColor = vec4( outgoingLight, diffuseColor.a );";

      if (clipCode) {
        shader.fragmentShader = shader.fragmentShader.replace(
          originalFragColor,
          `${clipCode}\n  ${originalFragColor}`
        );
      }
    }
  };

  return material;
}