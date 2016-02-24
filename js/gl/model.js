var Model = function (gl) {
    this.gl = gl;
};

Model.prototype.download = function(name) {
    var deferred = Q.defer();
    var http = new XMLHttpRequest();
    
    http.onreadystatechange = function () {
        if(http.readyState === 4 && http.status === 200) {
            deferred.resolve(http.responseText);
        }
    };
    
    http.open('GET', '/models/' + name + '.ply?rnd=' + Math.random() * 1000);
    http.send();
    
    return deferred.promise;
} 

Model.prototype.parse = function(data) {
    var lines = data.split('\n');
    var mesh = {};
    var bodyStart = this.parseHeader(mesh, lines);
    
    this.parseVertices(mesh, lines, bodyStart);
    this.parseFaces(mesh, lines, bodyStart + mesh.vertexCount);
    
    return Q(mesh);
};
    
Model.prototype.parseHeader = function(mesh, lines) {
    for(var i = 0; i < lines.length; i ++) {
        var line = lines[i].trim();
        
        if(line.startsWith('element vertex')) { mesh.vertexCount = this.parseHeaderValue(line); }
        if(line.startsWith('element face')) { mesh.faceCount = this.parseHeaderValue(line); }
        
        if(line === 'end_header') { return i + 1; }
    }
}; 

Model.prototype.parseVertices = function(mesh, lines, start) {
    mesh.vertices = [];
    mesh.colors = [];
    mesh.normals = [];

    for(var i = start; i < start + mesh.vertexCount; i ++) {
        var values = lines[i].trim().split(' ');
        
        mesh.vertices.push(values[0]);
        mesh.vertices.push(values[1]);
        mesh.vertices.push(values[2]);
        
        mesh.normals.push(values[3]);
        mesh.normals.push(values[4]);
        mesh.normals.push(values[5]);
        
        mesh.colors.push(values[6] / 256);
        mesh.colors.push(values[7] / 256);
        mesh.colors.push(values[8] / 256);
    }
};    

Model.prototype.parseFaces = function(mesh, lines, start) {
    mesh.indices = [];

    for(var i = start; i < lines.length; i ++) {
        var values = lines[i].trim().split(' ');
        if(values.length !== 4) { continue; }
        
        mesh.indices.push(values[1]);
        mesh.indices.push(values[2]);
        mesh.indices.push(values[3]);
    }
};

Model.prototype.parseHeaderValue = function(line) {
    var n = line.split(" ");
    return parseInt(n[n.length - 1]);
};

Model.prototype.bindBuffers = function(mesh) {
    
    if(!mesh.vertexBuffer) { mesh.vertexBuffer = this.gl.createBuffer(); }
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, mesh.vertexBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(mesh.vertices), this.gl.STATIC_DRAW);
    mesh.vertexBuffer.itemSize = 3;
    
    if(mesh.colors) {
        if(!mesh.colorBuffer) { mesh.colorBuffer = this.gl.createBuffer(); }
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, mesh.colorBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(mesh.colors), this.gl.STATIC_DRAW);
        mesh.colorBuffer.itemSize = 3;
    }
    
    if(mesh.normals) {
        if(!mesh.normalBuffer) { mesh.normalBuffer = this.gl.createBuffer(); }
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, mesh.normalBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(mesh.normals), this.gl.STATIC_DRAW);
        mesh.normalBuffer.itemSize = 3;
    }
        
    if(!mesh.indexBuffer) { mesh.indexBuffer = this.gl.createBuffer(); }
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
    this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(mesh.indices), this.gl.STATIC_DRAW);
    mesh.indexBuffer.numItems = mesh.indices.length;
    
    return Q(mesh);
};
    
Model.prototype.load = function (name) {
    var deferred = Q.defer();
    var self = this;
    
    this.download(name)
        .then(this.parse.bind(this))
        .then(function(rawData) {
            return self.bindBuffers(rawData);
        })
        .then(function (mesh) {
            mesh.shininess = 0;
            mesh.opacity = 1.0;
            
            console.log('RESOLVE: ' + name);
            deferred.resolve(mesh); 
        })
        .catch(function(error) {
            console.error(error); 
            deferred.reject();
        })
        .done();
    
    return deferred.promise;
};

Model.prototype.build = function (rawData) {
    var deferred = Q.defer();
    
    this.bindBuffers(rawData)
        .then(function (mesh) {
            mesh.shininess = 0;
            mesh.opacity = 1.0;
            mesh.specularWeight = 1.0;
            
            console.log('RESOLVE: raw');
            deferred.resolve(mesh); 
        })
        .catch(function(error) {
            console.error(error); 
            deferred.reject();
        })
        .done();
    
    return deferred.promise;
};

Model.prototype.rotate = function (mesh, angle) {
    var cosTheta = Math.cos(angle);
    var sinTheta = Math.sin(angle);
        
    for(var i = 0; i < mesh.vertices.length; i += 3) {
        var x = cosTheta * (mesh.vertices[i]) - sinTheta*(mesh.vertices[i + 2]);
        var z = sinTheta * (mesh.vertices[i]) + cosTheta*(mesh.vertices[i + 2]);
        
        mesh.vertices[i] = x;
        mesh.vertices[i + 2] = z;
        
        var nx = cosTheta * (mesh.normals[i]) - sinTheta*(mesh.normals[i + 2]);
        var nz = sinTheta * (mesh.normals[i]) + cosTheta*(mesh.normals[i + 2]);
        
        mesh.normals[i] = nx;
        mesh.normals[i + 2] = nz;
    }
    
    this.bindBuffers(mesh);
};

Model.prototype.clone = function (sourceMesh) {
    return Object.create(sourceMesh);
};

Model.prototype.calculateNormals = function (mesh) {
    mesh.normals = Array(mesh.vertices.length);
    
    for (var i = 0; i < mesh.vertices.length; i += 9) {
        var a = vec3.fromValues(mesh.vertices[i], mesh.vertices[i + 1], mesh.vertices[i + 2]);
        var b = vec3.fromValues(mesh.vertices[i + 3], mesh.vertices[i + 4], mesh.vertices[i + 5]);
        var c = vec3.fromValues(mesh.vertices[i + 6], mesh.vertices[i + 7], mesh.vertices[i + 8]);

        var v1 = vec3.create(), v2 = vec3.create();
        
        vec3.subtract(v1, c, b);
        vec3.subtract(v2, a, b);
        vec3.cross(v1, v1, v2);
        vec3.normalize(v1, v1);
        
        mesh.normals[i] = v1[0];
        mesh.normals[i + 1] = v1[1];
        mesh.normals[i + 2] = v1[2];
        mesh.normals[i + 3] = v1[0];
        mesh.normals[i + 4] = v1[1];
        mesh.normals[i + 5] = v1[2];
        mesh.normals[i + 6] = v1[0];
        mesh.normals[i + 7] = v1[1];
        mesh.normals[i + 8] = v1[2];
    }
};

Model.prototype.render = function (mesh, shaderProgram) {
    var sp = shaderProgram.get();
    
    this.gl.uniform1f(sp.shininess, mesh.shininess); 
    this.gl.uniform1f(sp.opacity, mesh.opacity); 
    this.gl.uniform1f(sp.specularWeight, mesh.specularWeight);
    
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, mesh.vertexBuffer);
    this.gl.vertexAttribPointer(sp.vertexPositionAttribute, mesh.vertexBuffer.itemSize, this.gl.FLOAT, false, 0, 0);

    if(mesh.colorBuffer) {
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, mesh.colorBuffer);
        this.gl.vertexAttribPointer(sp.vertexColorAttribute, mesh.colorBuffer.itemSize, this.gl.FLOAT, false, 0, 0);
    }
    
    if(mesh.normalBuffer) {
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, mesh.normalBuffer);
        this.gl.vertexAttribPointer(sp.vertexNormalAttribute, mesh.normalBuffer.itemSize, this.gl.FLOAT, false, 0, 0);
    }
    
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
    this.gl.drawElements(this.gl.TRIANGLES, mesh.indexBuffer.numItems, this.gl.UNSIGNED_SHORT, 0);
};
    