﻿using Microsoft.Extensions.Logging;
using MyChess.Data;

namespace MyChess.Handlers
{
    public class UserHandler : BaseHandler
    {
        public UserHandler(ILogger log, IMyChessDataContext context)
            : base(log, context)
        {
        }
    }
}
