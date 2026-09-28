import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

jest.mock('../../../modules/users/users.service', () => ({
  UsersService: class UsersService {},
}));

import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const usersService = {
    findOne: jest.fn(),
  };
  const config = {
    get: jest.fn().mockReturnValue('test-access-secret'),
  } as unknown as ConfigService;
  const strategy = new JwtStrategy(config, usersService as never);

  beforeEach(() => jest.clearAllMocks());

  it('uses the current database role instead of the role in the token', async () => {
    usersService.findOne.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      role: { name: 'user' },
    });

    await expect(
      strategy.validate({ sub: 'user-1', email: 'user@example.com', role: 'admin' }),
    ).resolves.toEqual({
      userId: 'user-1',
      email: 'user@example.com',
      role: 'user',
    });
  });

  it('rejects a token when its user has been deleted', async () => {
    usersService.findOne.mockRejectedValue(new Error('missing'));

    await expect(
      strategy.validate({ sub: 'deleted-user', email: 'user@example.com', role: 'admin' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
