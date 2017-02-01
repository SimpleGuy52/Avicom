using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Web.Http;
using Trimetr.SecurityPortal.Application;
using Trimetr.SecurityPortal.Domain;
using Trimetr.SecurityPortal.Domain.RiskManagement;
using Trimetr.SecurityPortal.Domain.Security;
using Trimetr.SecurityPortal.Shared;

namespace Trimetr.SecurityPortal.Availability.WebApi.Risks.Requirements
{
	// WebApi controller - CRUD entity BusinessRequirements with EntityFramework
	
    public class BusinessRequirementsController : ApiController
    {
        private readonly ICurrentUserRightsEvaluatorProvider _currentUserRightsEvaluatorProvider;
        private readonly IMainUnitOfWorkFactory _mainUnitOfWorkFactory;

        public BusinessRequirementsController(ICurrentUserRightsEvaluatorProvider currentUserRightsEvaluatorProvider,
            IMainUnitOfWorkFactory mainUnitOfWorkFactory)
        {
            _currentUserRightsEvaluatorProvider = currentUserRightsEvaluatorProvider;
            _mainUnitOfWorkFactory = mainUnitOfWorkFactory;
        }


        [HttpPost]
        public object GetAll(BusinessRequirementsControllerGetParams @params)
        {
            if (
                !_currentUserRightsEvaluatorProvider.GetCurrent()
                    .HasAllPermissions(CompositePermissions.RiskCompliance_ReadData))
                throw new NotEnoughtPermissionsException();

            object result = null;

            using (var context = _mainUnitOfWorkFactory.Create())
            {
                var len = @params.FilterFulfillments?.Length;
                var filteredFormulations = context.GetRepository<BusinessRequirement>().All()
                    .Where(bf => (
                        string.IsNullOrEmpty(@params.Search) ||
                        bf.SecurityRequirement.Contains(@params.Search) ||
                        bf.BusinessProcess.Name.Contains(@params.Search)) &&
                                 ((len == null || len <= 0) ||
                                  @params.FilterFulfillments.Contains(bf.Fulfillment)));

                var total = filteredFormulations.Count();
                var values = filteredFormulations
                    .OrderBy(bf => bf.SecurityRequirement)
                    .Skip(@params.Skip)
                    .Take(@params.Top)
                    .Select(bf => new
                    {
                        Id = bf.Id,
                        SecurityRequirement = bf.SecurityRequirement,
                        Fulfillment = bf.Fulfillment,
                        Annotation = bf.Annotation,
                        BusinessProcessId = bf.BusinessProcessId,
                        BusinessProcessName = bf.BusinessProcess.Name
                    })
                    .ToArray();

                result = new
                {
                    Values = values,
                    Total = total
                };
            }

            return result;
        }


        [HttpPost]
        public void Delete(BusinessRequirementsControllerDeleteParams @params)
        {
            if (
                !_currentUserRightsEvaluatorProvider.GetCurrent()
                    .HasAllPermissions(CompositePermissions.RiskCompliance_EditData))
                throw new NotEnoughtPermissionsException();

            if (@params == null || @params.Ids.Length == 0)
                return;

            using (var context = _mainUnitOfWorkFactory.Create())
            {
                var objs = context.GetRepository<BusinessRequirement>().All()
                    .Where(item => @params.Ids.Contains(item.Id))
                    .ToArray();

                context.GetRepository<BusinessRequirement>().RemoveRange(objs);
                context.Commit();
            }
        }


        [HttpGet]
        public object Get(int? id)
        {
            if (
                !_currentUserRightsEvaluatorProvider.GetCurrent()
                    .HasAllPermissions(CompositePermissions.RiskCompliance_ReadData))
                throw new NotEnoughtPermissionsException();

            if (id == null)
                return null;

            object result = null;

            using (var context = _mainUnitOfWorkFactory.Create())
            {
                var obj = context.GetRepository<BusinessRequirement>().Get(id);
                if (obj != null)
                {
                    result = new
                    {
                        Id = obj.Id,
                        SecurityRequirement = obj.SecurityRequirement,
                        Fulfillment = obj.Fulfillment,
                        Annotation = obj.Annotation,
                        BusinessProcessId = obj.BusinessProcessId,
                        BusinessProcessName = obj.BusinessProcess.Name
                    };
                }
            }

            return result;
        }


        [HttpPost]
        public void Update(BusinessRequirementsControllerUpdateParams @params)
        {
            if (
                !_currentUserRightsEvaluatorProvider.GetCurrent()
                    .HasAllPermissions(CompositePermissions.RiskCompliance_EditData))
                throw new NotEnoughtPermissionsException();

            using (var context = _mainUnitOfWorkFactory.Create())
            {
                var obj = @params.Id == null
                    ? context.GetRepository<BusinessRequirement>().Create()
                    : context.GetRepository<BusinessRequirement>().Get(@params.Id);

                if (obj != null)
                {
                    obj.Annotation = @params.Annotation;
                    obj.SecurityRequirement = @params.SecurityRequirement;
                    obj.Fulfillment = (FulfillmentType) @params.Fulfillment;
                    obj.BusinessProcessId = @params.BusinessProcessId;
                    if (@params.Id == null)
                        context.GetRepository<BusinessRequirement>().Add(obj);
                }

                context.Commit();
            }
        }


        [HttpPost]
        public void UpdateFulfillment(UpdateFulfillmentParams @params)
        {
            if (
                !_currentUserRightsEvaluatorProvider.GetCurrent()
                    .HasAllPermissions(CompositePermissions.RiskCompliance_EditData))
                throw new NotEnoughtPermissionsException();

            using (var context = _mainUnitOfWorkFactory.Create())
            {
                var contr = context.GetRepository<BusinessRequirement>().Get(@params.Id);
                contr.Fulfillment = (FulfillmentType) @params.Fulfillment;
                context.Commit();
            }
        }
    }
}
