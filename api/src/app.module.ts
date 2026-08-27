import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import configuration from './config/configuration';
import { ENV_FILE_PATH } from './config/env.loader';
import { BudgetsModule } from './budgets/budgets.module';
import { CategoriesModule } from './categories/categories.module';
import { MembershipsModule } from './memberships/memberships.module';
import { RolesModule } from './roles/roles.module';
import { TransactionTypesModule } from './transaction-types/transaction-types.module';
import { TransactionsModule } from './transactions/transactions.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ENV_FILE_PATH,
      load: [configuration],
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('database.uri'),
        // Avoid IPv6 TLS handshake failures to Atlas on some Windows/Node setups.
        autoSelectFamily: false,
      }),
    }),
    TransactionsModule,
    BudgetsModule,
    UsersModule,
    CategoriesModule,
    MembershipsModule,
    TransactionTypesModule,
    RolesModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
