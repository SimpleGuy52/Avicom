/// <reference path="asset.folder.create.directive.js" />
(function() {
    'use strict';

    angular
        .module('app.assets')
        .controller('AssetsFoldersController', controller);

    controller.$inject = [
        '$q',
        '$scope',
        'oDataService',
        'sessionService',
        'webApiService',
        'modalService'
    ];

    function controller(
        $q,
        $scope,
        oDataService,
        sessionService,
        webApiService,
        modalService
    ) {

        $scope.filter = {
            folderId: null,
            isNested: true
        };
        $scope.selectedFolder = undefined;
        $scope.isEditFolder = false;
        $scope.isEditAllFolder = false;
        $scope.selectMode = ($scope.isSelectMode === 'true') ? true : false;
        $scope.isRootFolder = false;
        $scope.isFirstTimeRefresh = true;

        $scope.expand = expand;
        $scope.selectFolder = selectFolder;
        $scope.onAfterCreateAFD = onAfterCreateAFD;
        $scope.onAfterEditAFD = onAfterEditAFD;
        $scope.onAfterDeleteAFD = onAfterDeleteAFD;
        $scope.nestedChanged = nestedChanged;

        //////////

        var resolvedPromise = $q.resolve();

        function setSelectedFolderToNull() {
            $scope.selectedFolder = null;
            return resolvedPromise;
        };

        function selectFolder(folder) {
            expand(folder);
            if (folderChanged($scope.selectedFolder, folder)) {
                $scope.selectedFolder = folder;                
                $scope.isEditFolder = false;
                $scope.isEditFolder = checkPermissions($scope.selectedFolder);
                if (!$scope.isFirstTimeRefresh)
                    activateOnAfterSelect();
            };
        };

        function checkPermissions(folder) {
            var res = false;

            if ($scope.isEditAllFolder)
                res = true;
            else {
                if (folder === null)
                    res = false;
                else
                    res = checkIfFolderEdit($scope.selectedFolder.id);
            };

            return res;
        };

        function folderChanged(oldV, newV) {
            var res =
            (newV === null && angular.isUndefined(oldV)) ||
            (newV === null && oldV != null) ||
            (newV != null && oldV === null) ||
            (newV != null && angular.isUndefined(oldV)) ||
            (newV != null && newV.id != oldV.id);
            return res;
        };

        function activateOnAfterSelect() {
            if ($scope.onAfterSelect) {
                var isAllAssets = false;
                var folderIds = getFolderIds($scope.selectedFolder);
                var selectedFolderId = ($scope.selectedFolder != null) ? $scope.selectedFolder.id : null;
                if ($scope.filter.isNested && $scope.selectedFolder == null)
                    isAllAssets = true;
                $scope.onAfterSelect(folderIds, selectedFolderId, isAllAssets);
            };
            return resolvedPromise;
        };

        function nestedChanged() {
            if (!$scope.isFirstTimeRefresh)
                activateOnAfterSelect();
        };

        function getFolderIds(folder) {
            var filters = [];

            if (folder === null)
                filters.push('null');

            if ($scope.filter.isNested)
                filters = filters.concat(getAllIds(folder));
            else if (folder != null)
                filters.push(folder.id);

            return filters;
        };

        function getAllIds(folder) {
            var res = [];
            if (!folder) {
                _.forEach($scope.assetFolders, function(item) {
                    res = res.concat(getIdsInATreeRecurcion(item));
                })
            } else
                res = getIdsInATreeRecurcion(folder);
            return res;
        };

        function getIdsInATreeRecurcion(folder) {
            var res = [];
            res.push(folder.id);
            if (folder.children) {
                _.forEach(folder.children, function(i) {
                    res = res.concat(getIdsInATreeRecurcion(i));
                });
            };
            return res;
        };

        /////////////////

        function onAfterCreateAFD(promise) {
            refreshFolders(promise);
        };

        function onAfterEditAFD(promise) {
            refreshFolders(promise);

            //if ($scope.onAfterEdit)
            //    $scope.onAfterEdit(promise);
        };

        function onAfterDeleteAFD(promise) {
            var resultpromise = promise
                .then(selectParent);

            refreshFolders(resultpromise);

            //if ($scope.onAfterDelete)
            //    $scope.onAfterDelete(resultpromise);
        };

        function selectParent() {
            $scope.selectedFolder = $scope.selectedFolder.parent ? $scope.selectedFolder.parent : undefined;
        };

        /////////////////

        var queryOptions = {
            orderby: ['name'],
            select: ['id', 'name'],
            expand: ['parent($select=id)'],
            filter: ''
        };

        function getFolders() {
            queryOptions.filter = getFilter();

            return oDataService.getEntities({
                entityName: 'AssetFolder',
                options: queryOptions,
                resultContainer: $scope,
                resultContainerKey: 'assetFolders'
            });
        };

        function getFilter() {
            var filter = '';
            if ($scope.typeOfAsset)
                filter = "(typeOfAsset eq Trimetr.SecurityPortal.Shared.Assets.TypeOfAsset'" + $scope.typeOfAsset + "')";
            return filter;
        };

        function forEachFolderSetChildrens() {
            _.forEach($scope.assetFolders, function(af) {
                if (af.parent != null) {
                    var parent = af.parent = _.find($scope.assetFolders, {
                        id: af.parent.id
                    });
                    if (parent == null)
                        return;
                    if (parent.children === undefined)
                        parent.children = [af];
                    else
                        parent.children.push(af);
                }
            });
            $scope.assetFolders = _.filter($scope.assetFolders, {
                parent: null
            });
        };

        var expandedFolders = [];

        function expandFolders(folders) {
            expandRecurcion(folders);
        };

        function expandRecurcion(items) {
            _.forEach(items, function(item) {
                if (_.indexOf(expandedFolders, item.id) != -1)
                    expand(item);
                expandRecurcion(item.children);
            });
            return resolvedPromise;
        };

        function rememberExpandedFolders() {
            expandedFolders = [];
            rememberRecurcion($scope.assetFolders);
        };

        function rememberRecurcion(items) {
            _.forEach(items, function(item) {
                if (item.expanded === true)
                    expandedFolders.push(item.id);
                rememberRecurcion(item.children);
            });
        };

        function prepareSecurity() {
            var promise = resolvedPromise;
            $scope.isRootFolder =
                sessionService.hasPermissions([['Assets.ViewAllFolder']]) &&
                sessionService.hasPermissions([['Assets.ViewAllAsset']]);
            $scope.isEditAllFolder = sessionService.hasPermissions([['Assets.EditAllFolder']]);
            if (!$scope.isEditAllFolder)
                promise = getEffectiveAssetFolderPermission();
            return promise;
        };

        function getEffectiveAssetFolderPermission() {
            return oDataService.getEntities({
                    entityName: 'EffectiveAssetFolderPermission',
                    options: {
                        orderby: ['folder/id'],
                        select: ['id'],
                        expand: ['folder($select=id)', 'atomicPermission($select=code)']
                    },
                    resultContainer: $scope,
                    resultContainerKey: 'effectiveAssetFolderPermissions'
                })
                .then(convertEffectiveAssetFolderPermission);
        };

        function convertEffectiveAssetFolderPermission() {
            var permissions = [];
            _.forEach($scope.effectiveAssetFolderPermissions, function(i) {
                var res = _.find(permissions, {
                    folderId: i.folder.id
                });
                if (!res) {
                    res = {
                        folderId: i.folder.id,
                        permissions: []
                    };
                    permissions.push(res);
                };
                res.permissions.push(i.atomicPermission.code);
            });
            $scope.effectiveAssetFolderPermissions = permissions;
            return resolvedPromise;
        };

        function expand(item) {
            if ( item != null && item.children != null && item.children.length > 0) {
                item.expanded = !item.expanded;
            }            
        };

        function checkIfFolderEdit(folderId) {
            var res = false;
            var permissions = _.find($scope.effectiveAssetFolderPermissions, {
                folderId: folderId
            });
            if (permissions && _.includes(permissions.permissions, 'Folder.Edit'))
                res = true;
            return res;
        };

        ///////////////////////

        function refreshSelectedFolderRecurcion(folders) {
            _.forEach(folders, function(item) {
                if (item.id === $scope.selectedFolder.id)
                    $scope.selectedFolder = item;
                else
                    refreshSelectedFolderRecurcion(item.children);
            });
            return resolvedPromise;
        };

        function refreshSelectedFolder(folders, folder) {
            if (folders.length > 0) {
                if (folder)
                    refreshSelectedFolderRecurcion(folders)
                if (!$scope.selectedFolder)
                    setDefaultFolder(folders);
            };
        };

        function setDefaultFolder(folders) {
            if ($scope.isRootFolder)
                selectFolder(null);
            else if (folders.length > 0)
                selectFolder(folders[0]);
        };

        function prepareViewModel() {
            forEachFolderSetChildrens();
            expandFolders($scope.assetFolders);
            refreshSelectedFolder($scope.assetFolders, $scope.selectedFolder);
            $scope.isFirstTimeRefresh = false;

            return resolvedPromise;
        };

        function parallelPromise() {
            return $q.all([
                getFolders(),
                prepareSecurity()
            ]);
        };

        function refreshFolders(inputPromise) {
            var promise = resolvedPromise;
            if (inputPromise)
                promise = inputPromise;

            rememberExpandedFolders();

            $scope.loadingPromiseFolders = promise
                .then(parallelPromise)
                .then(prepareViewModel)
                .then(activateOnAfterSelect)
                .then(function() { $scope.isFirstTimeRefresh = false; })
                .catch(console.log.bind(console));
        };

        refreshFolders();
    };
})();