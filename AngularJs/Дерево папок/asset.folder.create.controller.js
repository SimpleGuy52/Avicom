(function() {
    'use strict';

    angular
        .module('app.assets')
        .controller('СreateAssetFolderController', controller);

    controller.$inject = [
        '$scope',
        '$state',
        '$q',
        'oDataService',
        'webApiService',
        'folderId',
        'parentFolderId',
        'typeOfAssets',

        'onAfterCreate',
        'onAfterEdit',
        'onAfterDelete'
    ];

    function controller(
        $scope,
        $state,
        $q,
        oDataService,
        webApiService,
        folderId,
        parentFolderId,
        typeOfAssets,
        
        onAfterCreate,
        onAfterEdit,
        onAfterDelete
    ) {

        $scope.folder = {
            folderName: '',
            selectedRoles: []
        };

        //////////

        $scope.loadingPromise = {};
        $scope.allRoles = [];
        $scope.folderId = folderId ? folderId : null;
        $scope.parentFolderId = parentFolderId ? parentFolderId : null;
        onAfterCreate = onAfterCreate ? onAfterCreate : null;
        onAfterEdit = onAfterEdit ? onAfterEdit : null;
        $scope.typeOfAssets = typeOfAssets;
        $scope.validName = false;
        $scope.requestFolder = {};

        $scope.add = add;
        $scope.remove = remove;
        $scope.cancel = cancel;
        $scope.save = save;

        /////////////

        var resolvedPromise = $q.resolve();

        $scope.$watch('folder.folderName', function () {
            if ($scope.folder.folderName != '')
                $scope.validName = true;
            else
                $scope.validName = false;
        }, true);
        
        function save() {
            var roleIds = getIds($scope.folder.selectedRoles);
            var dto = {
                Id: $scope.folderId,
                parentFolderId: $scope.parentFolderId,
                TypeOfAsset: $scope.typeOfAssets,
                Name: $scope.folder.folderName,
                RoleIds: roleIds
            };
            var promise = webApiService.postData('AssetsFolder', 'Update', dto);

            closeWindow(promise);
        };

        function closeWindow(promise) {
            if ($scope.folderId && onAfterEdit) {
                $scope.$dismiss();
                onAfterEdit(promise);
            }
            else if (!$scope.folderId && onAfterCreate) {
                $scope.$dismiss();
                onAfterCreate(promise);
            }
            else
                $scope.loadingPromise = promise
                    .then(function () { $scope.$dismiss(); });
        };

        function getIds(input) {
            var result = [];
            input.forEach(function(item) {
                result.push(item.id);
            });
            return result;
        };

        function cancel() {
            $scope.$dismiss();
        };

        function add(role) {
            role.added = true;
            $scope.folder.selectedRoles.push(role);
        };

        function remove(role) {
            role.added = false;
            _.pull($scope.folder.selectedRoles, role);
        };

        function loadAllRoles() {
            return oDataService.getEntities({
                entityName: 'Role',
                options: {
                    //filter: ["CompositePermissions/any(l:l/Code eq 'Availability.Read')"],
                    orderby: "name"
                },
                resultContainer: $scope,
                resultContainerKey: 'allRoles'
            }).then(function(data) {
                _.forEach($scope.allRoles, function(role) { role.added = false; });
            });
        };

        var assetQueryOptions = {
            expand: [
                'roles($select=id)'
            //    'responsible($select=id)',
            //    'reactionPlan($select=id)',
            //    'incidentExtraExtra'
            ]
        };

        function getAssetFolder() {
            if ($scope.folderId != null)
                return oDataService.getEntity('AssetFolder', $scope.folderId, assetQueryOptions, $scope, 'requestFolder');
            else {
                $scope.requestFolder = null;
                return resolvedPromise;
            }
        };

        function prepareViewModel() {
            if ($scope.requestFolder) {
                $scope.folder.folderName = $scope.requestFolder.name;
                _.forEach($scope.allRoles, function(allR) {
                    _.forEach($scope.requestFolder.roles, function (r) {
                        if (allR.id === r.id)
                            $scope.add(allR);
                    });
                });

            };
        };

        function refresh() {
            return loadAllRoles()
                .then(getAssetFolder)
                .then(prepareViewModel);
            //.then(prepareSecurity);
        };

        $scope.loadingPromise = refresh();
    };
})();