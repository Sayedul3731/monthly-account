import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('database.uri'),
        // Avoid IPv6 TLS handshake failures to Atlas on some Windows/Node setups.
        autoSelectFamily: false,
      }),
    }),
  ],
})
export class DatabaseModule {}
