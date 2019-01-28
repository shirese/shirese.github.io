#version 300 es

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

in vec3 position;

void main() {
    gl_Position = vec4( position, 1.0 );
}
