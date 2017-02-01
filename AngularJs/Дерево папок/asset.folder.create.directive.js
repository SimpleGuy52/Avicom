(function () {
    'use strict';

    angular
        .module('app.assets')
        .directive('assetFolderLink', dir);

    dir.$inject = [
        '$modal',
        'webApiService',
        'modalService'
    ];

    function dir($modal, webApiService, modalService) {
        var directive = {
            scope: {
                folderId: '@',
                folderName: '@',
                parentFolderId: '@',
                typeOfAsset: '@',

                onAfterCreate: '=',
                onAfterEdit: '=',
                onAfterDelete: '=',

                isDelete: '@'
            },
            link: link,
            restrict: 'A',
            replace: true
        };

        return directive;

        /////////////////

        var folderId;
        var folderName;
        var onAfterDelete;

        function link(scope, element, attrs) {
            element.bind('click', function () {
                parseValues(scope);
                if (scope.isDelete) {
                    folderId = scope.folderId;
                    folderName = scope.folderName;
                    onAfterDelete = scope.onAfterDelete;
                    ifDeleteFolder();
                }
                else
                    openModal(scope);
            });
        };

        function parseValues(scope) {
            scope.folderId = parseInt(scope.folderId) || null;
            scope.parentFolderId = parseInt(scope.parentFolderId) || null;
            //scope.isDelete = scope.isDelete === 'true' || true ? true : false;
            if (scope.isDelete === 'true' || scope.isDelete === true)
                scope.isDelete = true;
            else
                scope.isD = false;
        };

        function ifDeleteFolder() {
            modalService.confirm('Удаление папки',
                    "Удалить папку : " +
                    folderName +
                    " и все содержимое в ней ?",
                    deleteFolder);
        };

        function deleteFolder() {
            var dto = [];
            dto.push(folderId);
            var promise = webApiService.postData('AssetsFolder', 'DeleteFolders', dto);
            if (onAfterDelete)
                onAfterDelete(promise)
        };

        function openModal(scope) {
            $modal.open({
                templateUrl: 'app/assets/folders/asset.folder.create.html',
                controller: 'СreateAssetFolderController',
                resolve: {
                    folderId: function () { return scope.folderId; },
                    parentFolderId: function () { return scope.parentFolderId; },
                    typeOfAssets: function () { return scope.typeOfAsset; },

                    onAfterCreate: function () { return scope.onAfterCreate; },
                    onAfterEdit: function () { return scope.onAfterEdit; },
                    onAfterDelete: function () { return scope.onAfterDelete; }
                },
                size: 'lg',
                backdrop: 'static'
            });
        };
    };
})();