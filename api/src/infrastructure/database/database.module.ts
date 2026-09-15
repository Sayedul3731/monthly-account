import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { setServers } from 'node:dns';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const uri = config.getOrThrow<string>('database.uri');
        const dnsServers = config.get<string[]>('database.dnsServers', []);

        // Atlas connection strings use DNS SRV records. Some local DNS proxies
        // refuse SRV lookups even when ordinary hostname lookups work.
        if (uri.startsWith('mongodb+srv://') && dnsServers.length > 0) {
          setServers(dnsServers);
        }

        return {
          uri,
          // Avoid IPv6 TLS handshake failures to Atlas on some Windows/Node setups.
          autoSelectFamily: false,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
