precision mediump float;

uniform sampler2D uColorTexture;
uniform sampler2D uDepthTexture;
varying vec2 vTexCoords;

// FXAA
#define FXAA_REDUCE_MIN   (1.0/ 128.0)
#define FXAA_REDUCE_MUL   (1.0 / 8.0)
#define FXAA_SPAN_MAX     8.0

uniform bool uEnableFXAAFS;
varying vec2 vResolution;
varying vec2 v_rgbNW;
varying vec2 v_rgbNE;
varying vec2 v_rgbSW;
varying vec2 v_rgbSE;
varying vec2 v_rgbM;

void fxaa() {
	vec4 color;
	mediump vec2 inverseVP = vec2(1.0 / vResolution.x, 1.0 / vResolution.y);
	vec3 rgbNW = texture2D(uColorTexture, v_rgbNW).xyz;
	vec3 rgbNE = texture2D(uColorTexture, v_rgbNE).xyz;
	vec3 rgbSW = texture2D(uColorTexture, v_rgbSW).xyz;
	vec3 rgbSE = texture2D(uColorTexture, v_rgbSE).xyz;
	vec4 texColor = texture2D(uColorTexture, v_rgbM);
	vec3 rgbM  = texColor.xyz;
	vec3 luma = vec3(0.299, 0.587, 0.114);
	float lumaNW = dot(rgbNW, luma);
	float lumaNE = dot(rgbNE, luma);
	float lumaSW = dot(rgbSW, luma);
	float lumaSE = dot(rgbSE, luma);
	float lumaM  = dot(rgbM,  luma);
	float lumaMin = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));
	float lumaMax = max(lumaM, max(max(lumaNW, lumaNE), max(lumaSW, lumaSE)));
	
	mediump vec2 dir;
	dir.x = -((lumaNW + lumaNE) - (lumaSW + lumaSE));
	dir.y =  ((lumaNW + lumaSW) - (lumaNE + lumaSE));
	
	float dirReduce = max((lumaNW + lumaNE + lumaSW + lumaSE) *
						  (0.25 * FXAA_REDUCE_MUL), FXAA_REDUCE_MIN);
	
	float rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
	dir = min(vec2(FXAA_SPAN_MAX, FXAA_SPAN_MAX),
			  max(vec2(-FXAA_SPAN_MAX, -FXAA_SPAN_MAX),
			  dir * rcpDirMin)) * inverseVP;
	
	vec3 rgbA = 0.5 * (
		texture2D(uColorTexture, gl_FragCoord.xy * inverseVP + dir * (1.0 / 3.0 - 0.5)).xyz +
		texture2D(uColorTexture, gl_FragCoord.xy * inverseVP + dir * (2.0 / 3.0 - 0.5)).xyz);
	vec3 rgbB = rgbA * 0.5 + 0.25 * (
		texture2D(uColorTexture, gl_FragCoord.xy * inverseVP + dir * -0.5).xyz +
		texture2D(uColorTexture, gl_FragCoord.xy * inverseVP + dir *  0.5).xyz);

	float lumaB = dot(rgbB, luma);
	if ((lumaB < lumaMin) || (lumaB > lumaMax))
		color = vec4(rgbA, texColor.a);
	else
		color = vec4(rgbB, texColor.a);
		
	gl_FragColor = color;
}


// BLOOM
uniform sampler2D uBloomTexture;
uniform bool uEnableBloom;
uniform vec4 uBloomColor;
varying vec2 vBlurTexCoords1[5];

void bloom() {
	float sum = 0.0;
	float count = 0.0;
	const float size = 0.02;
	const float interval = 0.005;
	
	for(float x = -size; x <= size; x += interval) {
		for(float y = -size; y <= size; y += interval) {
			vec4 col = texture2D(uBloomTexture, vTexCoords + vec2(x, y));
			
			if(col.r + col.g + col.b > 1.0) {
				sum += (col.r + col.g + col.b) / 3.0;
			}
			
			count += 1.0;
		}
	}
	
	sum /= count;
	gl_FragColor = mix(gl_FragColor, vec4(0.768, 1.0, 0.992, 1.0), sum);
}

void main(void) {
	gl_FragColor = texture2D(uColorTexture, vTexCoords);
	
	if(uEnableFXAAFS) { fxaa(); }
	if(uEnableBloom) { bloom(); }
}
