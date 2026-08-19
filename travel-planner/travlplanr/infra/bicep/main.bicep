@description('The location for all resources.')
param location string = resourceGroup().location

@description('The environment name (e.g., dev, prod).')
param environmentName string = 'prod'

@description('Administrator password for the PostgreSQL Flexible Server. Pass at deploy time (e.g. from Key Vault via a pipeline variable) — never hardcode this.')
@secure()
param pgAdminPassword string

var acrName = 'travlplanracr${uniqueString(resourceGroup().id)}'
var acaEnvName = 'cae-travlplanr-${environmentName}'
var pgServerName = 'psql-travlplanr-${environmentName}'
var redisName = 'redis-travlplanr-${environmentName}'

// 1. Azure Container Registry
resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01-preview' = {
  name: acrName
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: true
  }
}

// 2. PostgreSQL Flexible Server
resource pgServer 'Microsoft.DBforPostgreSQL/flexibleServers@2023-12-01-preview' = {
  name: pgServerName
  location: location
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    administratorLogin: 'psqladmin'
    administratorLoginPassword: pgAdminPassword
    version: '16'
    storage: {
      storageSizeGB: 32
    }
  }
}

// 3. Azure Cache for Redis
resource redisCache 'Microsoft.Cache/redis@2023-08-01' = {
  name: redisName
  location: location
  properties: {
    sku: {
      name: 'Basic'
      family: 'C'
      capacity: 0
    }
  }
}

// 4. Azure Container Apps Environment
resource acaEnv 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: acaEnvName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
    }
  }
}

output acrLoginServer string = acr.properties.loginServer
output pgFqdn string = pgServer.properties.fullyQualifiedDomainName
output redisHost string = redisCache.properties.hostName
