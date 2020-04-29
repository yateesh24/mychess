﻿using System;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using Microsoft.Net.Http.Headers;

namespace MyChess.Functions
{
    public class SecurityValidator : ISecurityValidator
    {
        private readonly AzureADOptions _securityValidatorOptions;
        private TokenValidationParameters? _tokenValidationParameters;
        private SemaphoreSlim _initializationSemaphore = new SemaphoreSlim(1, 1);

        public SecurityValidator(IOptions<AzureADOptions> securityValidatorOptions)
        {
            _securityValidatorOptions = securityValidatorOptions.Value;
        }

        private async Task InitializeAsync(ILogger log)
        {
            var configurationManager = new ConfigurationManager<OpenIdConnectConfiguration>(
                $"https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration",
                new OpenIdConnectConfigurationRetriever());

            var configuration = await configurationManager.GetConfigurationAsync();
            _tokenValidationParameters = new TokenValidationParameters
            {
                IssuerSigningKeys = configuration.SigningKeys,
                ValidAudiences = new[]
                {
                    _securityValidatorOptions.Audience,
                    _securityValidatorOptions.ClientId
                },
                ValidateIssuer = true,
                IssuerValidator = (issuer, securityToken, validationParameters) =>
                {
                    return IssuerValidationLogic(log, issuer) ? issuer : null;
                }
            };
        }

        private bool IssuerValidationLogic(ILogger log, string issuer)
        {
            const string start = "https://login.microsoftonline.com/";
            const string end = "/v2.0";
            if (!issuer.StartsWith(start) || !issuer.EndsWith(end))
            {
                log.LogWarning(LoggingEvents.FuncSecInvalidIssuer,
                    "Invalid issuer {issuer}", issuer);
                return false;
            }

            var tenant = issuer.Replace(start, string.Empty).Replace(end, string.Empty);
            log.LogInformation(LoggingEvents.FuncSecIssuer, "Issuer tenant {issuer}", tenant);
            return true;
        }

        public async Task<ClaimsPrincipal?> GetClaimsPrincipalAsync(HttpRequest req, ILogger log)
        {
            if (!req.Headers.ContainsKey(HeaderNames.Authorization))
            {
                log.LogTrace(LoggingEvents.FuncSecNoAuthHeader,
                    "Request does not contain authorization header");
                return null;
            }

            var authorizationValue = req.Headers[HeaderNames.Authorization].ToString().Split(' ');
            if (authorizationValue.Length != 2 &&
                authorizationValue[0] != JwtBearerDefaults.AuthenticationScheme)
            {
                log.LogTrace(LoggingEvents.FuncSecNoBearerToken,
                    "Request does not contain Bearer token");
                return null;
            }

            var accessToken = authorizationValue[1];
            var tokenHandler = new JwtSecurityTokenHandler();

            if (_tokenValidationParameters == null)
            {
                await _initializationSemaphore.WaitAsync();
                if (_tokenValidationParameters == null)
                {
                    try
                    {
                        log.LogTrace(LoggingEvents.FuncSecInitializing,
                            "Initializing OpenID configuration");
                        await InitializeAsync(log);
                        log.LogTrace(LoggingEvents.FuncSecInitialized,
                            "Initialized OpenID configuration successfully");
                    }
                    catch (Exception ex)
                    {
                        log.LogError(LoggingEvents.FuncSecInitializingFailed,
                            ex, "Could not initialize OpenID configuration");
                        return null;
                    }
                    finally
                    {
                        _initializationSemaphore.Release();
                    }
                }
            }

            try
            {
                var claimsPrincipal = tokenHandler.ValidateToken(
                    accessToken, 
                    _tokenValidationParameters, 
                    out SecurityToken securityToken);
                return claimsPrincipal;
            }
            catch (Exception ex)
            {
                log.LogError(LoggingEvents.FuncSecTokenValidationFailed,
                    ex, "Token validation failed");
                return null;
            }
        }
    }
}