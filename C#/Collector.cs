using System;
using System.CodeDom;
using System.Collections.Generic;
using System.Data;
using System.Data.SqlClient;
using System.Linq;
using System.Runtime.InteropServices;
using System.Runtime.Remoting.Messaging;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Threading.Tasks;
using Trimetr.CollAgent3.CollectorIntf;

namespace Trimetr.CollAgent3.Collectors.DiasoftFa
{
	// Задача сборщика (Collector DiasoftFa)
	// Необходимо переодически получать данные из таблицы MSSQL Server
	// И на основании полученных данных генерировать объекты типа SecurityEvent
	// После эти данные будут отправлены на ядро системы QRadar (Siem from Microsoft)
	
    public class Collector : IActiveCollector
    {
		// Настройки необходимые для подключения к БД MSSQL
        private readonly Settings _settings;
        private readonly string _connectionString;
		// Последняя считанная запись
        private decimal _lastAuditId;

        private const string EventPrefix = "Diasoft_Fa#_";
        private const string AnchorPrefix = "lastAuditId=";
        private const char DelimeterChar = '=';

        public Collector(Settings settings)
        {
            _settings = settings;
            _connectionString = MakeConnectionString(settings);
        }

        public void Dispose()
        {
        }

        public object GetState()
        {
            return null;
        }

        public string GetAnchor()
        {
            _lastAuditId = GetLastAuditId();
            return MakeAnchor();
        }

        public Tuple<string, SecurityEvent[]> CollectEvents(string state, int maxCount)
        {
            return CollectEvents(state);
        }

		// Возвращает массив объектов Типа SecurityEvent
        public Tuple<string, SecurityEvent[]> CollectEvents(string state)
        {
            SetAnchor(state);
            var audits = new List<AuditProxy>();
            var commandString = MakeCommandString(_lastAuditId, _settings.Database);
            IDbCommand command = new SqlCommand(commandString);
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                command.Connection = connection;
                connection.Open();
                var reader = command.ExecuteReader();
                AuditProxy last;
                audits = GetAuditProxies(reader, out last);
                if (last != null) _lastAuditId = last.AuditId;
            }

            var secEvents = MapSecEvents(audits);

            return new Tuple<string, SecurityEvent[]>(MakeAnchor(), secEvents.ToArray());
        }

        public static TestConnectionResult TestConnection(string connectionString)
        {
            var result = new TestConnectionResult();
            result.Success = false;

            using (IDbConnection connection = new SqlConnection(connectionString))
            {
                try
                {
                    connection.Open();
                }
                catch (Exception exc)
                {
                    result.Message = exc.Message + "\n\n" + exc.InnerException;
                }
            }

            result.Success = true;
            return result;
        }

        private string MakeAnchor()
        {
            return AnchorPrefix + _lastAuditId;
        }

        private void SetAnchor(string state)
        {
            _lastAuditId = state != null ? ParseLastAuditId(state) : 0;
        }

        private decimal GetLastAuditId()
        {
            decimal lastAuditId = 0;
            var commandString = MakeCommandStringLastAuditId(_settings.Database);
            IDbCommand command = new SqlCommand(commandString);
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                command.Connection = connection;
                connection.Open();
                var reader = command.ExecuteReader();
                if (reader.Read())
                    lastAuditId = reader.GetDecimal(0);
            }

            return lastAuditId;
        }

        private static decimal ParseLastAuditId(string state)
        {
            if (state == null)
                return 0;

            var stateSplited = state.Split(DelimeterChar);

            if (stateSplited.Count() != 2)
                return 0;

            decimal lastId;
            if (!decimal.TryParse(stateSplited[1], out lastId))
                return 0;

            return lastId;
        }

        private static List<AuditProxy> GetAuditProxies(IDataReader reader, out AuditProxy last)
        {
            var audits = new List<AuditProxy>();
            while (reader.Read())
            {
                var audit = new AuditProxy
                {
                    AuditId = reader.GetDecimal(0),
                    InDateTime = reader.GetDateTime(1),
                    Action = (int) reader.GetByte(2),
                    Comment = reader.GetString(3).Trim(),
                    ObjectName = reader.GetString(4).Trim(),
                    UserId = reader.GetDecimal(5),
                    ObjectId = reader.GetDecimal(6),
                    HostInfoId = reader.GetDecimal(7),
                    Verified = reader.GetBoolean(8),
                    ObjectReference = reader.GetBoolean(9),
                    UserBrief = reader.GetString(10).Trim(),
                    UserFioBrief = reader.GetString(11).Trim(),
                    UserName = reader.GetString(12).Trim(),
                    HostInfoName = reader.GetString(13).Trim()
                };

                audits.Add(audit);
            }
            last = audits.LastOrDefault();
            return audits;
        }

        private List<SecurityEvent> MapSecEvents(IEnumerable<AuditProxy> audits)
        {
            var list = new List<SecurityEvent>();

            foreach (var item in audits)
            {
                var secEvent = new SecurityEvent();

                string found = null;
                ActionFieldsLibrary.ActionMapper.TryGetValue(item.Action, out found);
                var action = found ?? item.Action.ToString();

                secEvent.DeviceTime = item.InDateTime;
                secEvent.EventName = EventPrefix + action;
                secEvent.EventDescription = item.Comment;
                secEvent.EventCategory = item.ObjectName;
                secEvent.UserName = item.UserBrief == null ? item.UserId.ToString() : item.UserBrief;
                secEvent.HostIP = _settings.Server;
                secEvent.HostName = item.HostInfoName;

                secEvent.ExtraParams.Add("EventID", item.AuditId.ToString());
                secEvent.ExtraParams.Add("ObjectID", item.ObjectId.ToString());

                list.Add(secEvent);
            }

            return list;
        }

        public static string MakeConnectionString(Settings settings)
        {
            var sb = new SqlConnectionStringBuilder
            {
                DataSource = settings.Port == 0
                    ? settings.Server
                    : $"{settings.Server},{settings.Port}",
                InitialCatalog = settings.Database
            };
            if (settings.IntegratedSecurity)
                sb.IntegratedSecurity = true;
            else if (!string.IsNullOrEmpty(settings.User))
            {
                sb.UserID = settings.User;
                sb.Password = settings.Password;
            }
            return sb.ToString();
        }

        private static string MakeCommandString(decimal lastAuditId, string databaseName)
        {
            return string.Format(@"
                            SELECT TOP 1000  [A].[AuditID]
                                ,[A].[InDateTime]
                                ,[A].[Action]
                                ,[A].[Comment]
                                ,[A].[ObjectName]
                                ,[U].[UserID]
                                ,[A].[ObjectID]
                                ,[A].[HostInfoID]
                                ,[A].[Verified]
                                ,[A].[ObjectReference]
                                ,[U].[Brief] as [UserBrief]
                                ,[U].[FIOBrief] as [UserFIOBrief]
                                ,[U].[Name] as [UserName]
                                ,[H].[Descr] as [HostInfo]
                            FROM [tAudit] as A
                            with (nolock)
                            inner join tUser as U
                            on A.UserID = U.UserID
                            inner join tHost as H
                            on H.HostID = A.HostInfoID
                            where A.AuditID > {0}
                            order by [A].[AuditId] asc 
                ", lastAuditId);
        }

        private static string MakeCommandStringLastAuditId(string databaseName)
        {
            return string.Format(@"
                        SELECT TOP 1 [A].[AuditID]
                        FROM [tAudit] as [A]
                        order by [A].[AuditId] desc
                    ", databaseName);
        }
    }

    public class TestConnectionResult
    {
        public bool Success { get; set; }
        public string Message { get; set; }
    }
}
