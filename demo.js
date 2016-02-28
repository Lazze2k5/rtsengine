(function() {
    var renderTarget = document.getElementById('viewport');
    var infoBox = document.getElementById('info');
    
    var viewport = new Viewport(renderTarget);
    var larx = new Larx(viewport);
    var gameLoop = new GameLoop(60);
    var mousePicker = new MousePicker(larx, 0.5);
    var pickObjects = [];
    
    var defaultShader, waterShader, mouseShader;

    var mTrees, mObjects, mWater, mTerrain;
    var waterColor = [0.359, 0.781, 0.800];

    initShaders()
        .then(initTerrain)
        .then(initWater)
        .then(initTrees)
        .then(initObjects)
        .then(function() {
            gameLoop.start(doLogic, render);
        })
        .catch(function(err) {
            console.error(err);
        });

    function initShaders() {
        var deferred = Q.defer();
        
        defaultShader = new DefaultShader(larx);
        waterShader = new WaterShader(larx);
        mouseShader = new MouseShader(larx);
        
        Q.all([
            defaultShader.load(),
            waterShader.load(),
            mouseShader.load()
        ]).then(function() {
            defaultShader.setWaterColor(waterColor);
            waterShader.setWaterColor(waterColor);
            deferred.resolve();
        }).catch(function (e) { 
            console.error(e);
            deferred.reject();
        });
        
        return deferred.promise;         
    }

    function initTerrain() {
        var deferred = Q.defer();
        
        mTerrain = new Terrain(larx);
        mTerrain.generate('/maps/test', 9.0, 1.5, 1)              
            .then(function(t) {
                mTerrain.colors = undefined;
                mTerrain.normals = undefined;
                mTerrain.shininess = 4.0;
                mTerrain.specularWeight = 0.35;  
                
                deferred.resolve(true);
            })
            .catch(function(e) { console.error(e); });
            
        return deferred.promise;
    }

    function initWater() {
        var quality = 32;
        var deferred = Q.defer();
        
        mWater = new Water(larx, gameLoop);
        mWater.generate(mTerrain, quality).then(function(w) {
            deferred.resolve(true);
        })
        .catch(function(e) { console.error(e); });
        
        return deferred.promise;
    }

    function initTrees() {
        var deferred = Q.defer();
        var model = new Model(larx, 'tree');
                    
        model.load().then(function() {
            var count = 0;
            var bounds = (mTerrain.size / 2) - 2;
            mTrees = new Model(larx, 'trees');
                        
            while(count < 800) {
                var tree = model.clone();
                var x = Math.random() * (mTerrain.size - 2) - ((mTerrain.size - 2) / 2);
                var z = Math.random() * (mTerrain.size - 2) - ((mTerrain.size - 2) / 2);
                var y = mTerrain.getElevationAtPoint(x, z) - 0.02;
                
                var tx = (Math.random() - 0.5) * Math.PI / 12.0;
                var ty = (Math.random() - 0.5) * Math.PI / 12.0;
                
                if(y >= 1.0 && y < 4.0 && x > -bounds && x < bounds && z > -bounds && z < bounds) {
                    tree.rotate([tx, Math.random() * Math.PI, ty]);
                    tree.translate([x, y, z]);
                    
                    mTrees.push(tree);
                    count++;
                }
            }
            
            mTrees.shininess = 1.0;
            mTrees.specularWeight = 1.0;
            mTrees.bindBuffers();
            
            deferred.resolve(true);
        })
        .catch(function(e) { console.error(e); });
        
        return deferred.promise;
    }


    function initObjects() {
        var deferred = Q.defer();
        var models = [
            new Model(larx, 'rock-1'),
            new Model(larx, 'rock-2'),
            new Model(larx, 'crate')
        ];
        
        Q.all([models[0].load(), models[1].load(), models[2].load()]).then(function() {
            var count = 0;
            var bounds = (mTerrain.size / 2) - 2;
            mObjects = new Model(larx, 'objects');
            
            while(count < 150) {
                var object = models[Math.floor(Math.random() * models.length)].clone();
                var x = Math.random() * (mTerrain.size - 2) - ((mTerrain.size - 2) / 2);
                var z = Math.random() * (mTerrain.size - 2) - ((mTerrain.size - 2) / 2);
                var y = mTerrain.getElevationAtPoint(x, z);
                
                if(y >= -2.0 && y < 3.5 && x > -bounds && x < bounds && z > -bounds && z < bounds) {
                    var size = object.getSize();
                    var angle = mTerrain.getAngle(x, z, size[0], size[1]);
                    
                    object.rotate([0, Math.random() * Math.PI, 0]);
                    object.rotate(angle);
                    object.translate([x, y, z]);
                    object.pickId = count;
                    
                    var pickObject = {
                        id: count,
                        type: object.name
                    };
                    
                    mousePicker.addObject(object, pickObject.id);
                    pickObjects.push(pickObject);
                    
                    mObjects.push(object);
                    count ++;
                }
            }
            
            mObjects.shininess = 1.0;
            mObjects.specularWeight = 0.7;
            mObjects.bindBuffers();
            deferred.resolve(true);
        })
        .catch(function(e) { console.error(e); });
        
        
        return deferred.promise;
    }
        
    function doLogic(time, frameCount) {
        keyboard();
        mouse();
        
        mWater.update();
    }

    function render() {
        larx.render(function() {
            defaultShader.use();
            mTerrain.render(defaultShader);
            mTrees.render(defaultShader);
            mObjects.render(defaultShader);
            
            waterShader.use();
            mWater.render(waterShader);
            
            mouseShader.use();
            mousePicker.render(mouseShader, mTerrain);
        });
    }

    function keyboard() {
        if(viewport.keyDown('W')) { larx.camera.move( 0.0,  0.5); }
        if(viewport.keyDown('S')) { larx.camera.move( 0.0, -0.5); }
        if(viewport.keyDown('A')) { larx.camera.move(-0.5,  0.0); }
        if(viewport.keyDown('D')) { larx.camera.move( 0.5,  0.0); }
    }

    function mouse() {
        mousePicker.updateMouse(viewport.mouse.x, viewport.mouse.y);
        
        if(viewport.mouse.buttons.right || viewport.mouse.touchDown) {  
            var dX = viewport.mouse.deltaX / 3.0,
                dY = viewport.mouse.deltaY / 3.0;
                
            var cMatrix = larx.camera.getMatrix();
            var dYRad = dY * Math.PI / 180;
            
            larx.camera.rotate(dX, 0);
            
            if(dYRad > 0) {
                if(cMatrix.rotV + dYRad < Math.PI - 0.2) { larx.camera.rotate(0, dY); }
            } else {
                if(cMatrix.rotV + dYRad > 0.2) { larx.camera.rotate(0, dY); }
            }
        }
        
        if(viewport.mouse.buttons.left) {
            var coords = mousePicker.getCoordinates(viewport.mouse.x, viewport.mouse.y);
            infoBox.style.display = 'none';
            
            if(coords) {
                infoBox.innerHTML = 'Coordinates, x: ' + coords[0].toFixed(2) + ' y: ' + coords[1].toFixed(2) + ' z: ' + coords[2].toFixed(2);
                infoBox.style.display = 'block';
            }
                        
            var id = mousePicker.getObjectId(viewport.mouse.x, viewport.mouse.y);
            if(id) {
                var pickObject = pickObjects.filter(function (obj) { return obj.id == id })[0];
                infoBox.innerHTML = 'Selected: ' + pickObject.type + ' (ID: ' + pickObject.id + ')';
                infoBox.style.display = 'block';
            } 
        }
        
        if(viewport.mouse.wheelDelta !== 0) {
            larx.camera.zoom(-viewport.mouse.wheelDelta * 2);
        }
        
        viewport.resetDelta();
    }

    document.getElementById('fullscreen').onclick = function() {
        viewport.toggleFullscreen();
    };
    
})();