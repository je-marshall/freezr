import os
import logging
from datetime import timedelta
from flask import Flask

def create_app(test_config=None):
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_mapping(
        SECRET_KEY='dev',
        DATABASE=os.path.join(app.instance_path, 'freezr.sqlite'),
        PERMANENT_SESSION_LIFETIME=timedelta(days=365),
    )
    if test_config is None:
        app.config.from_pyfile('config.py', silent=True)
    else:
        app.config.from_mapping(test_config)

    logging.basicConfig(
        level=logging.DEBUG,
        format='%(asctime)s %(name)s %(levelname)s %(message)s',
    )
    app.logger.setLevel(logging.DEBUG)
    app.logger.info('Freezr starting up, db=%s', app.config['DATABASE'])
    try:
        os.makedirs(app.instance_path)
    except OSError:
        pass
        
    @app.route('/hello')
    def hello():
        return 'Hello, World!'
        
    from . import db
    db.init_app(app)
    
    from . import auth
    app.register_blueprint(auth.bp)
    
    from . import index
    app.register_blueprint(index.bp)
    
    from . import checkin
    app.register_blueprint(checkin.bp)
    
    from . import checkout
    app.register_blueprint(checkout.bp)
    
    from . import move
    app.register_blueprint(move.bp)
    
    from . import api
    app.register_blueprint(api.bp)
    
    from . import freezers
    app.register_blueprint(freezers.bp)
    
    from . import categories
    app.register_blueprint(categories.bp)

    from . import item
    app.register_blueprint(item.bp)
    
    app.add_url_rule('/', endpoint='index')
    
    return app
