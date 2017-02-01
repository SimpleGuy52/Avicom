(function () {
    'use strict';

    angular
        .module('app.assets')
        .directive('assetsFolders', dir);

    dir.$inject = [
    ];

    function dir(
    ) {
        var directive = {
            restrict: 'A',
            scope: {
                onAfterSelect: '=',
                onAfterEdit: '=',
                onAfterDelete: '=',
                typeOfAsset: '=',
                isSelectMode: '@'
            },
            templateUrl: 'app/assets/folders/assets.folders.html',
            controller: 'AssetsFoldersController'
        };

        return directive;
    };
})();