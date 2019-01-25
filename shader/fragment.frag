uniform vec2 u_resolution;
        uniform vec2 u_mouse;
        uniform float u_time;

        const int MAX_MARCHING_STEPS = 255;
        const float MIN_DIST = 0.0;
        const float MAX_DIST = 100.0;
        const float EPSILON = 0.0001;

        float opUnion( float d1, float d2 ) {  return(min(d1,d2)); }

        float sdRoundCone( in vec3 p, in float r1, float r2, float h )
        {
            vec2 q = vec2( length(p.xz), p.y );
            
            float b = (r1-r2)/h;
            float a = sqrt(1.0-b*b);
            float k = dot(q,vec2(-b,a));
            
            if( k < 0.0 ) return length(q) - r1;
            if( k > a*h ) return length(q-vec2(0.0,h)) - r2;
                
            return dot(q, vec2(a,b) ) - r1;
        }

        float sphereSDF(vec3 samplePoint) {
            return length(samplePoint) - 0.75;
        }

        vec2 map(vec3 p) {
            vec2 ret;
            mat3 rotTest;
            rotTest[0] = vec3(cos(radians(u_time)), -sin(radians(u_time)), 0);
            rotTest[1] = vec3(sin(radians(u_time)), cos(radians(u_time)), 0);
            rotTest[2] = vec3(0, 0, 1);
            float displacement = sin(0.75 * p.x * u_time) * sin(0.75 * p.y * u_time) * sin(1.25 * p.z * u_mouse.y * 0.001) * 0.25;
            vec2 sphere = vec2(sphereSDF(p + vec3(0, 0.1, 0)), 0.25);
            vec2 cone = vec2(sdRoundCone(rotTest * p, 0.5, 0.5, 0.5), 0.5);
            ret.x = opUnion(sphere.x, cone.x);
            if (sphere.x < cone.x)
                ret.y = sphere.y;
            else
                ret.y = cone.y;
            return ret;
        }

        vec3 estimateNormal(vec3 pos) {
                vec2 e = vec2(1.0,-1.0)*0.5773*0.0005;
                return normalize( e.xyy*map( pos + e.xyy ).x + 
                                e.yyx*map( pos + e.yyx ).x + 
                                e.yxy*map( pos + e.yxy ).x + 
                                e.xxx*map( pos + e.xxx ).x );
        }

        vec3 phongContribForLight(vec3 k_d, vec3 k_s, float alpha, vec3 p, vec3 ro,
                                vec3 lightPos, vec3 lightIntensity) {
            vec3 N = estimateNormal(p);
            vec3 L = normalize(lightPos - p);
            vec3 V = normalize(ro - p);
            vec3 R = normalize(reflect(-L, N));
            
            float dotLN = dot(L, N);
            float dotRV = dot(R, V);
            
            if (dotLN < 0.0) {
                // Light not visible from this point on the surface
                return vec3(0.0, 0.0, 0.0);
            } 
            
            if (dotRV < 0.0) {
                // Light reflection in opposite direction as viewer, apply only diffuse
                // component
                return lightIntensity * (k_d * dotLN);
            }
            return lightIntensity * (k_d * dotLN + k_s * pow(dotRV, alpha));
        }

        vec3 phongIllumination(vec3 k_a, vec3 k_d, vec3 k_s, float alpha, vec3 p, vec3 ro) {
            const vec3 ambientLight = 0.5 * vec3(1.0, 1.0, 1.0);
            vec3 color = ambientLight * k_a;
            
            vec3 light1Pos = normalize( vec3(-0.4, 0.7, -0.6) );
            vec3 light1Intensity = vec3(0.4, 0.4, 0.4);
            
            color += phongContribForLight(k_d, k_s, alpha, p, ro,
                                        light1Pos,
                                        light1Intensity);
            return color;
        }

        void phongShade(vec3 p, vec3 ro, vec3 K_d) {
            vec3 K_a;
            vec3 K_s;
            float shininess;
            K_a = vec3(0.2, 0.2, 0.2);
            K_s = vec3(1.0, 1.0, 1.0);
            shininess = 10.0;
            vec3 color = phongIllumination(K_a, K_d, K_s, shininess, p, ro);
            gl_FragColor = vec4(color, 1.0);
        }

        float shortestDistanceToSurface(vec3 ro, vec3 rd, float start, float end) {
            float depth = start;
            for (int i = 0; i < MAX_MARCHING_STEPS; i++) {
                vec2 p = map(ro + depth * rd);
                float dist = p.x;
                if (dist < EPSILON) {
                    if (p.y <= 0.25)
                        phongShade(ro + dist * rd, ro, vec3(0.54, 0.332, 0.3124));
                    else if (p.y <= 0.5)
                        phongShade(ro + dist * rd, ro, vec3(0.31, 0.25, 0.34));
                    return depth;
                }
                depth += dist;
                if (depth >= end) {
                    return end;
                }
            }
            return end;
        }

        vec3 rayDirection(float fieldOfView, vec2 size, vec2 fragCoord) {
            vec2 xy = fragCoord - size / 2.0;
            float z = size.y / tan(radians(fieldOfView) / 2.0);
            return normalize(vec3(xy, -z));
        }
        
        mat3 setCamera( in vec3 ro, in vec3 ta, float cr )
        {
            vec3 cw = normalize(ta-ro);
            vec3 cp = vec3(sin(cr), cos(cr),0.0);
            vec3 cu = normalize( cross(cw,cp) );
            vec3 cv = normalize( cross(cu,cw) );
            return mat3( cu, cv, cw );
        }

        void main()
        {
            vec2 mo = u_mouse.xy / u_resolution.xy;
            vec3 ro = vec3( 4.6*cos(1.0*u_time + 6.0*mo.x), 1.0 + 2.0*mo.y, 0.5 + 4.6*sin(1.0*u_time + 6.0*mo.x) );
            vec3 ta = vec3(-0.5, -0.4, 0.5);
            mat3 ca = setCamera(ro, ta, 0.0);
            vec2 p = (-u_resolution.xy + 2.0 * gl_FragCoord.xy) / u_resolution.y;
            vec3 rd = ca * normalize(vec3(p.xy, 2.0));
            float dist = shortestDistanceToSurface(ro, rd, MIN_DIST, MAX_DIST);
            if (dist > MAX_DIST - EPSILON) {
                gl_FragColor = vec4(0.1, 0.1, 0.18, 0.0);
                return;
            }
        }
